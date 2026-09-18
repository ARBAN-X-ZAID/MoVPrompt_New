#!/usr/bin/env bash
set -euo pipefail

target_environment="${1:-}"
if [[ "${target_environment}" != "staging" && "${target_environment}" != "production" ]]; then
  echo "Usage: $0 <staging|production>" >&2
  exit 64
fi

required_variables=(
  APP_ENV
  PUBLIC_APP_URL
  WEB_ORIGIN
  API_ORIGIN
  CORS_ALLOWED_ORIGINS
  VITE_API_ORIGIN
  VITE_FEATURE_PORTABLE_AUTH
  VITE_AUTH_REQUIRE_EMAIL_VERIFICATION
  VITE_FEATURE_GUEST_CREATOR
  VITE_FEATURE_WORKSPACE_SHELL
  VITE_FEATURE_PROJECTS
  VITE_FEATURE_ADVANCED_MODE
  VITE_FEATURE_EXPORT_PIPELINE
  VITE_FEATURE_LOCAL_DEMO_GENERATION
  FEATURE_AUTHENTICATION
  FEATURE_ASSETS
  FEATURE_TEMPLATE_MODE
  FEATURE_ADVANCED_MODE
  FEATURE_GENERATION
  FEATURE_EXPORTS
  FEATURE_BILLING
  MONGODB_URI
  MONGODB_DATABASE
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_ASSETS_BUCKET
  R2_OUTPUTS_BUCKET
  R2_TEMPLATE_PREVIEWS_BUCKET
  R2_UPLOAD_URL_TTL_SECONDS
  R2_DOWNLOAD_URL_TTL_SECONDS
  SMTP_HOST
  SMTP_PORT
  SMTP_SECURE
  EMAIL_FROM
  BETTER_AUTH_URL
  BETTER_AUTH_SECRET
  BETTER_AUTH_TRUSTED_ORIGINS
)

missing=0
for variable_name in "${required_variables[@]}"; do
  variable_value="${!variable_name:-}"
  if [[ -z "${variable_value}" || "${variable_value}" == *REQUIRED_* || "${variable_value}" == *example.invalid* ]]; then
    echo "Missing or placeholder value: ${variable_name}" >&2
    missing=1
  fi
done

if [[ "${missing}" -ne 0 ]]; then
  exit 1
fi

if [[ "${APP_ENV}" != "${target_environment}" ]]; then
  echo "APP_ENV=${APP_ENV} does not match requested environment ${target_environment}." >&2
  exit 1
fi

if [[ ! "${PUBLIC_APP_URL}" =~ ^https:// || ! "${WEB_ORIGIN}" =~ ^https:// || ! "${API_ORIGIN}" =~ ^https:// || ! "${VITE_API_ORIGIN}" =~ ^https:// || ! "${BETTER_AUTH_URL}" =~ ^https:// ]]; then
  echo "Public, API, Vite API and Better Auth URLs must use HTTPS outside local development." >&2
  exit 1
fi

if [[ -n "${R2_TEMPLATE_PREVIEWS_BASE_URL:-}" && ! "${R2_TEMPLATE_PREVIEWS_BASE_URL}" =~ ^https:// ]]; then
  echo "R2_TEMPLATE_PREVIEWS_BASE_URL must be empty for a shared private bucket or use HTTPS." >&2
  exit 1
fi

if [[ "${PUBLIC_APP_URL%/}" != "${WEB_ORIGIN%/}" ]]; then
  echo "WEB_ORIGIN must match PUBLIC_APP_URL for the canonical browser origin." >&2
  exit 1
fi

if [[ "${BETTER_AUTH_URL%/}" != "${API_ORIGIN%/}" ]]; then
  echo "BETTER_AUTH_URL must match the public API_ORIGIN that serves /api/auth/*." >&2
  exit 1
fi

if [[ "${VITE_API_ORIGIN%/}" != "${API_ORIGIN%/}" ]]; then
  echo "VITE_API_ORIGIN must match the public API_ORIGIN used by the browser." >&2
  exit 1
fi

IFS=',' read -r -a cors_origins <<< "${CORS_ALLOWED_ORIGINS}"
for cors_origin in "${cors_origins[@]}"; do
  if [[ ! "${cors_origin}" =~ ^https:// ]]; then
    echo "Every CORS_ALLOWED_ORIGINS entry must use HTTPS outside local development." >&2
    exit 1
  fi
done

if [[ ! "${MONGODB_URI}" =~ ^mongodb(\+srv)?:// ]]; then
  echo "MONGODB_URI must be a MongoDB connection string." >&2
  exit 1
fi

for boolean_variable in VITE_FEATURE_PORTABLE_AUTH VITE_AUTH_REQUIRE_EMAIL_VERIFICATION VITE_FEATURE_GUEST_CREATOR VITE_FEATURE_WORKSPACE_SHELL VITE_FEATURE_PROJECTS VITE_FEATURE_ADVANCED_MODE VITE_FEATURE_EXPORT_PIPELINE VITE_FEATURE_LOCAL_DEMO_GENERATION FEATURE_AUTHENTICATION FEATURE_ASSETS FEATURE_TEMPLATE_MODE FEATURE_ADVANCED_MODE FEATURE_GENERATION FEATURE_EXPORTS FEATURE_BILLING SMTP_SECURE; do
  boolean_value="${!boolean_variable}"
  if [[ "${boolean_value}" != "true" && "${boolean_value}" != "false" ]]; then
    echo "${boolean_variable} must be true or false." >&2
    exit 1
  fi
done

if [[ "${VITE_AUTH_REQUIRE_EMAIL_VERIFICATION}" != "false" ]]; then
  echo "VITE_AUTH_REQUIRE_EMAIL_VERIFICATION must be false for the current deferred first-campaign verification policy." >&2
  exit 1
fi

if [[ -n "${AUTH_REQUIRE_EMAIL_VERIFICATION:-}" ]]; then
  echo "AUTH_REQUIRE_EMAIL_VERIFICATION is obsolete and must be removed; the server owns the current verification policy." >&2
  exit 1
fi

if [[ "${VITE_FEATURE_LOCAL_DEMO_GENERATION}" != "false" ]]; then
  echo "VITE_FEATURE_LOCAL_DEMO_GENERATION must be false outside local development." >&2
  exit 1
fi

if [[ "${VITE_FEATURE_ADVANCED_MODE}" != "${FEATURE_ADVANCED_MODE}" ]]; then
  echo "VITE_FEATURE_ADVANCED_MODE must match FEATURE_ADVANCED_MODE." >&2
  exit 1
fi

if [[ "${VITE_FEATURE_EXPORT_PIPELINE}" != "${FEATURE_EXPORTS}" ]]; then
  echo "VITE_FEATURE_EXPORT_PIPELINE must match FEATURE_EXPORTS." >&2
  exit 1
fi

if [[ "${FEATURE_ASSETS}" == "true" && "${FEATURE_AUTHENTICATION}" != "true" ]]; then
  echo "FEATURE_ASSETS=true requires FEATURE_AUTHENTICATION=true." >&2
  exit 1
fi

if [[ "${FEATURE_GENERATION}" == "true" ]]; then
  if [[ "${FEATURE_AUTHENTICATION}" != "true" ]]; then
    echo "FEATURE_GENERATION=true requires FEATURE_AUTHENTICATION=true." >&2
    exit 1
  fi
  if [[ "${FEATURE_ASSETS}" != "true" ]]; then
    echo "FEATURE_GENERATION=true requires FEATURE_ASSETS=true." >&2
    exit 1
  fi
  if [[ ! "${WORKER_HEARTBEAT_INTERVAL_SECONDS:-}" =~ ^[0-9]+$ || "${WORKER_HEARTBEAT_INTERVAL_SECONDS}" -lt 1 ]]; then
    echo "WORKER_HEARTBEAT_INTERVAL_SECONDS must be a positive integer." >&2
    exit 1
  fi
  if [[ ! "${WORKER_HEARTBEAT_MAX_AGE_SECONDS:-}" =~ ^[0-9]+$ || "${WORKER_HEARTBEAT_MAX_AGE_SECONDS}" -le "${WORKER_HEARTBEAT_INTERVAL_SECONDS}" ]]; then
    echo "WORKER_HEARTBEAT_MAX_AGE_SECONDS must be greater than WORKER_HEARTBEAT_INTERVAL_SECONDS." >&2
    exit 1
  fi
  generation_variables=(
    GENERATION_PRICING_VERSION
    GENERATION_QUOTE_TTL_SECONDS
    GUEST_TRUST_PROXY
    GUEST_DAILY_BUDGET_USD
    GUEST_MAX_RENDER_COST_USD
    WORKER_ID
    WORKER_SMOKE_TEST_ON_START
    WORKER_OUTBOX_BATCH_SIZE
    WORKER_OUTBOX_LEASE_MS
    WORKER_OUTBOX_POLL_INTERVAL_MS
    WORKER_RENDER_RECONCILIATION_DELAY_SECONDS
    WORKER_HEARTBEAT_INTERVAL_SECONDS
    WORKER_HEARTBEAT_MAX_AGE_SECONDS
  )
  for variable_name in "${generation_variables[@]}"; do
    if [[ -z "${!variable_name:-}" ]]; then
      echo "FEATURE_GENERATION=true requires ${variable_name}." >&2
      exit 1
    fi
  done

  for variable_name in GUEST_TRUST_PROXY WORKER_SMOKE_TEST_ON_START; do
    variable_value="${!variable_name}"
    if [[ "${variable_value}" != "true" && "${variable_value}" != "false" ]]; then
      echo "FEATURE_GENERATION=true requires ${variable_name} to be true or false." >&2
      exit 1
    fi
  done

  for variable_name in WORKER_OUTBOX_BATCH_SIZE WORKER_OUTBOX_LEASE_MS WORKER_OUTBOX_POLL_INTERVAL_MS WORKER_RENDER_RECONCILIATION_DELAY_SECONDS; do
    variable_value="${!variable_name}"
    if [[ ! "${variable_value}" =~ ^[0-9]+$ || "${variable_value}" -lt 1 ]]; then
      echo "FEATURE_GENERATION=true requires positive integer ${variable_name}." >&2
      exit 1
    fi
  done

  for variable_name in GUEST_DAILY_BUDGET_USD GUEST_MAX_RENDER_COST_USD; do
    variable_value="${!variable_name}"
    if [[ ! "${variable_value}" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
      echo "FEATURE_GENERATION=true requires positive numeric ${variable_name}." >&2
      exit 1
    fi
  done

  generation_boolean_variables=(
    GENERATION_STARTER_ONLY
    MOVPROMPT_PROVIDER_VERCEL_GATEWAY_READY
    MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_ENABLED
    MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_ENABLED
    MOVPROMPT_CAPABILITY_IMAGE_PRODUCT_ENABLED
    VERCEL_GATEWAY_SEEDANCE_GENERATE_AUDIO
  )
  for variable_name in "${generation_boolean_variables[@]}"; do
    variable_value="${!variable_name:-}"
    if [[ "${variable_value}" != "true" && "${variable_value}" != "false" ]]; then
      echo "FEATURE_GENERATION=true requires ${variable_name} to be true or false." >&2
      exit 1
    fi
  done

  if [[ "${MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_ENABLED}" != "true" || "${MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_ENABLED}" != "true" ]]; then
    echo "FEATURE_GENERATION=true requires both installed video capabilities to be enabled." >&2
    exit 1
  fi

  if [[ "${MOVPROMPT_CAPABILITY_IMAGE_PRODUCT_ENABLED}" == "true" ]]; then
    echo "image.product must remain disabled until a production image adapter and quality gate are installed." >&2
    exit 1
  fi

  if [[ "${MOVPROMPT_PROVIDER_VERCEL_GATEWAY_READY}" != "true" ]]; then
    echo "FEATURE_GENERATION=true requires MOVPROMPT_PROVIDER_VERCEL_GATEWAY_READY=true after staging acceptance evidence." >&2
    exit 1
  fi

  video_capability_prefixes=(
    MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC
    MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY
  )
  enabled_video_capability_count=0
  selected_video_model=""
  for capability_prefix in "${video_capability_prefixes[@]}"; do
    enabled_variable="${capability_prefix}_ENABLED"
    adapter_variable="${capability_prefix}_ADAPTER_ID"
    model_variable="${capability_prefix}_MODEL_ID"
    if [[ "${!enabled_variable}" == "true" ]]; then
      enabled_video_capability_count=$((enabled_video_capability_count + 1))
      if [[ "${!adapter_variable:-}" != "vercel-ai-gateway" ]]; then
        echo "${adapter_variable} must be vercel-ai-gateway for the installed production adapter." >&2
        exit 1
      fi
      capability_model="${!model_variable:-}"
      if [[ "${APP_ENV}" == "local" ]]; then
        if [[ "${capability_model}" != "bytedance/seedance-2.5" && "${capability_model}" != "bytedance/seedance-v1.0-pro-fast" ]]; then
          echo "${model_variable} must be Seedance 2.5 or the explicit local Seedance Fast model." >&2
          exit 1
        fi
      elif [[ "${capability_model}" != "bytedance/seedance-2.5" ]]; then
        echo "${model_variable} must be exactly bytedance/seedance-2.5 outside local development." >&2
        exit 1
      fi
      if [[ -n "${selected_video_model}" && "${selected_video_model}" != "${capability_model}" ]]; then
        echo "Enabled video capabilities must select the same server-only model." >&2
        exit 1
      fi
      selected_video_model="${capability_model}"

      pricing_prefix="GENERATION_VIDEO_${capability_prefix#MOVPROMPT_CAPABILITY_VIDEO_}"
      for resolution in 480P 720P; do
        pricing_variable="${pricing_prefix}_${resolution}_CREDITS_PER_SECOND"
        pricing_value="${!pricing_variable:-}"
        if [[ ! "${pricing_value}" =~ ^[0-9]+$ || "${pricing_value}" -lt 1 ]]; then
          echo "${enabled_variable}=true requires positive integer ${pricing_variable}." >&2
          exit 1
        fi
      done
    fi
  done

  provider_variables=(
    PROVIDER_OUTPUT_ALLOWED_HOSTS
    AI_GATEWAY_API_KEY
    VERCEL_AI_GATEWAY_BASE_URL
    MOVPROMPT_QUALITY_MODEL_ID
    FFPROBE_PATH
    FFMPEG_PATH
  )
  for variable_name in "${provider_variables[@]}"; do
    if [[ -z "${!variable_name:-}" || "${!variable_name}" == *REQUIRED_* || "${!variable_name}" == *example.invalid* ]]; then
      echo "FEATURE_GENERATION=true requires ${variable_name}." >&2
      exit 1
    fi
  done

  if [[ "${VERCEL_AI_GATEWAY_BASE_URL}" != "https://ai-gateway.vercel.sh/v4/ai" ]]; then
    echo "VERCEL_AI_GATEWAY_BASE_URL must be the audited https://ai-gateway.vercel.sh/v4/ai endpoint." >&2
    exit 1
  fi

  if [[ ! "${MOVPROMPT_QUALITY_MODEL_ID}" =~ ^google/gemini-[a-z0-9.-]+$ ]]; then
    echo "MOVPROMPT_QUALITY_MODEL_ID must be an explicit Google Gemini Gateway model slug." >&2
    exit 1
  fi

  IFS=',' read -r -a provider_output_hosts <<< "${PROVIDER_OUTPUT_ALLOWED_HOSTS}"
  for provider_output_host in "${provider_output_hosts[@]}"; do
    provider_output_host="${provider_output_host//[[:space:]]/}"
    if [[ -z "${provider_output_host}" || "${provider_output_host}" == *'*'* || "${provider_output_host}" == *'/'* || "${provider_output_host}" == *':'* || "${provider_output_host}" == "localhost" || "${provider_output_host}" =~ ^[0-9.]+$ ]]; then
      echo "PROVIDER_OUTPUT_ALLOWED_HOSTS must contain exact public hostnames without schemes, paths, ports or wildcards." >&2
      exit 1
    fi
  done

  expected_output_host="ark-acg-ap-southeast-1.tos-ap-southeast-1.volces.com"
  if [[ "${selected_video_model}" == "bytedance/seedance-v1.0-pro-fast" ]]; then
    expected_output_host="ark-content-generation-ap-southeast-1.tos-ap-southeast-1.volces.com"
  fi
  expected_output_host_found=false
  for provider_output_host in "${provider_output_hosts[@]}"; do
    if [[ "${provider_output_host//[[:space:]]/}" == "${expected_output_host}" ]]; then
      expected_output_host_found=true
      break
    fi
  done
  if [[ "${expected_output_host_found}" != "true" ]]; then
    echo "PROVIDER_OUTPUT_ALLOWED_HOSTS must include the exact reviewed host for the selected video model." >&2
    exit 1
  fi

  if [[ "${VERCEL_GATEWAY_SEEDANCE_RESOLUTION_TIER:-}" != "480p" && "${VERCEL_GATEWAY_SEEDANCE_RESOLUTION_TIER:-}" != "720p" ]]; then
    echo "VERCEL_GATEWAY_SEEDANCE_RESOLUTION_TIER must be 480p or 720p." >&2
    exit 1
  fi

  if [[ "${FFPROBE_PATH}" != "ffprobe" || "${FFMPEG_PATH}" != "ffmpeg" ]]; then
    echo "Container generation requires FFPROBE_PATH=ffprobe and FFMPEG_PATH=ffmpeg." >&2
    exit 1
  fi
fi

if [[ "${VITE_FEATURE_PORTABLE_AUTH}" == "true" && "${FEATURE_AUTHENTICATION}" != "true" ]]; then
  echo "VITE_FEATURE_PORTABLE_AUTH=true requires FEATURE_AUTHENTICATION=true." >&2
  exit 1
fi

if (( ${#BETTER_AUTH_SECRET} < 32 )); then
  echo "BETTER_AUTH_SECRET must contain at least 32 characters." >&2
  exit 1
fi

if [[ ! "${R2_ACCOUNT_ID}" =~ ^[a-fA-F0-9]{32}$ ]]; then
  echo "R2_ACCOUNT_ID must be a 32-character Cloudflare account ID." >&2
  exit 1
fi

for bucket_variable in R2_ASSETS_BUCKET R2_OUTPUTS_BUCKET R2_TEMPLATE_PREVIEWS_BUCKET; do
  bucket_value="${!bucket_variable}"
  if [[ ! "${bucket_value}" =~ ^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$ ]]; then
    echo "${bucket_variable} must be a valid R2 bucket name." >&2
    exit 1
  fi
done

if [[ -n "${R2_TEMPLATE_PREVIEWS_BASE_URL:-}" && ( "${R2_TEMPLATE_PREVIEWS_BUCKET}" == "${R2_ASSETS_BUCKET}" || "${R2_TEMPLATE_PREVIEWS_BUCKET}" == "${R2_OUTPUTS_BUCKET}" ) ]]; then
  echo "A shared customer-media R2 bucket must remain private; leave R2_TEMPLATE_PREVIEWS_BASE_URL empty." >&2
  exit 1
fi

if [[ -n "${SMTP_USER:-}" || -n "${SMTP_PASSWORD:-}" ]]; then
  if [[ -z "${SMTP_USER:-}" || -z "${SMTP_PASSWORD:-}" ]]; then
    echo "SMTP_USER and SMTP_PASSWORD must be configured together." >&2
    exit 1
  fi
fi

for oauth_provider in GOOGLE APPLE; do
  client_id_variable="${oauth_provider}_CLIENT_ID"
  client_secret_variable="${oauth_provider}_CLIENT_SECRET"
  if [[ -n "${!client_id_variable:-}" || -n "${!client_secret_variable:-}" ]]; then
    if [[ -z "${!client_id_variable:-}" || -z "${!client_secret_variable:-}" ]]; then
      echo "${client_id_variable} and ${client_secret_variable} must be configured together." >&2
      exit 1
    fi
  fi
done

for integer_variable in SMTP_PORT R2_UPLOAD_URL_TTL_SECONDS R2_DOWNLOAD_URL_TTL_SECONDS; do
  integer_value="${!integer_variable}"
  if [[ ! "${integer_value}" =~ ^[0-9]+$ || "${integer_value}" -lt 1 ]]; then
    echo "${integer_variable} must be a positive integer." >&2
    exit 1
  fi
done

for ttl_variable in R2_UPLOAD_URL_TTL_SECONDS R2_DOWNLOAD_URL_TTL_SECONDS; do
  ttl_value="${!ttl_variable}"
  if [[ "${ttl_value}" -gt 3600 ]]; then
    echo "${ttl_variable} cannot exceed 3600 seconds." >&2
    exit 1
  fi
done

if [[ "${target_environment}" == "production" ]]; then
  for variable_name in PUBLIC_APP_URL WEB_ORIGIN API_ORIGIN VITE_API_ORIGIN CORS_ALLOWED_ORIGINS MONGODB_URI R2_ACCOUNT_ID BETTER_AUTH_URL BETTER_AUTH_TRUSTED_ORIGINS; do
    variable_value="${!variable_name}"
    if [[ "${variable_value}" == *localhost* || "${variable_value}" == *127.0.0.1* ]]; then
      echo "Production value cannot point to a local address: ${variable_name}" >&2
      exit 1
    fi
  done

  if [[ ! "${MONGODB_URI}" =~ ^mongodb\+srv:// ]]; then
    echo "Production MONGODB_URI must use the TLS-enabled MongoDB Atlas SRV form." >&2
    exit 1
  fi
fi

echo "${target_environment} environment contract is complete. Secret values were not printed."
