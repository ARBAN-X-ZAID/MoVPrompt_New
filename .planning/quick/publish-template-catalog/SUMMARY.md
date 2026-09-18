# Publish launch templates on API Mongo readiness

Campaign setup was fail-closing because live Mongo had no published templates. The API now upserts the launch catalog the first time Mongo readiness runs, the same way `db:migrate` already did. The UI still fails closed if that catalog is missing.
