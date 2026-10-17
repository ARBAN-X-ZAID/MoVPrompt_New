from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT

ROOT = Path(__file__).resolve().parent
DEST = ROOT / "MovPrompt_V2_Client_Proposal_Revised.pdf"
pdfmetrics.registerFont(TTFont("Arial", "/System/Library/Fonts/Supplemental/Arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"))
W, H = 595.276, 841.89
INK, MUTED, TEAL, LINE, PALE = map(HexColor, ["#192936", "#526579", "#008781", "#CEDFDF", "#E8F4F2"])
c = canvas.Canvas(str(DEST), pagesize=(W, H))
c.setTitle("MovPrompt Version 2 - Client Proposal")
c.setAuthor("MovPrompt")
styles = {
    "body": ParagraphStyle("body", fontName="Arial", fontSize=9.2, leading=13, textColor=INK),
    "small": ParagraphStyle("small", fontName="Arial", fontSize=8, leading=11.5, textColor=MUTED),
    "label": ParagraphStyle("label", fontName="Arial-Bold", fontSize=7.3, leading=10, textColor=TEAL),
    "title": ParagraphStyle("title", fontName="Arial-Bold", fontSize=13, leading=17, textColor=INK),
}

def para(text, x, top, width, style="body"):
    p = Paragraph(text, styles[style])
    _, h = p.wrap(width, H)
    p.drawOn(c, x, H-top-h)
    return top+h

def start(title, subtitle):
    c.setFillColor(INK); c.rect(0,H-10,W,10,fill=1,stroke=0)
    c.setFont("Arial-Bold",11); c.setFillColor(TEAL); c.drawString(44,H-43,"MOVPROMPT")
    c.setFont("Arial-Bold",8); c.setFillColor(MUTED); c.drawRightString(W-44,H-43,"VERSION 2 / CLIENT PROPOSAL")
    c.setFont("Arial-Bold",23); c.setFillColor(INK); c.drawString(44,H-80,title)
    para(subtitle,44,94,W-88,"small")
    c.setStrokeColor(LINE); c.line(44,H-121,W-44,H-121)

def finish(n):
    c.setStrokeColor(LINE); c.line(44,45,W-44,45)
    para("Proposed scope. Examples are illustrative; provider, rights and quality checks apply.",44,H-35,W-120,"small")
    c.setFont("Arial",8); c.setFillColor(MUTED); c.drawRightString(W-44,26,f"{n} / 5")
    c.showPage()

def card(top, height, badge, title, sections, reference=None):
    x=44; width=W-88
    c.setStrokeColor(LINE); c.setFillColor(white)
    c.roundRect(x,H-top-height,width,height,12,stroke=1,fill=1)
    c.setFillColor(PALE); c.roundRect(x+16,H-top-42,29,27,6,fill=1,stroke=0)
    c.setFillColor(TEAL); c.setFont("Arial-Bold",9); c.drawCentredString(x+30.5,H-top-32,badge)
    para(title,x+57,top+19,width-76,"title")
    y=top+57
    for label, body in sections:
        y=para(label.upper(),x+18,y,width-36,"label")+3
        y=para(body,x+18,y,width-36)+8
    if reference:
        label,url=reference
        y+=1
        c.setStrokeColor(LINE); c.line(x+18,H-y,x+width-18,H-y)
        y=para(f'<b>Reference:</b> <link href="{url}" color="#526579">{label}</link>',x+18,y+8,width-36,"small")
    assert y <= top+height-10, (title,y,top+height)

start("Planned capabilities", "A focused next phase for easier, more consistent business advertising")
card(144,269,"01","Separate Adstudio: Image-Only UGC Product Ads",[
    ("What we will build","The only required Adstudio form field is one product-image upload. It will not request a product URL, brand, audience, style or message details."),
    ("How it works","The customer picks an Adstudio preset. That preset supplies the UGC-style character and ad direction for the uploaded product image."),
    ("Business benefit","A simple image-in, ad-out flow for business owners, without prompt writing or filling in a long brief."),
    ("Delivery consideration","Character and generation options depend on supported capabilities, quality checks and rights. Product claims and likeness or voice use must be approved."),
])
card(429,274,"02","Reusable product and presenter libraries",[
    ("What we will build","We will let customers save approved product photos and presenter references, then select them again for later campaigns."),
    ("Practical example","A perfume retailer will save its bottle photos and approved animated host, then reuse them for a launch ad, a gifting ad and a seasonal campaign."),
    ("Business benefit","Less repeated uploading and more consistent references across campaigns."),
    ("Delivery consideration","Product and presenter assets will remain separate, with controls for replacement, permission review and deletion. Saved references guide consistency; identical generations are not guaranteed."),
],("Higgsfield Cinema Studio - reusable Elements","https://higgsfield.ai/creator-hub/help-center/tools/how-do-i-use-cinema-studio"))
finish(1)

start("Frame control and new templates", "Planned additions with clear examples and product-focused direction")
card(144,268,"03","Start and end frame choice",[
    ("What we will build","We will let customers supply or choose the opening and closing images, so an ad starts and finishes with a deliberate composition."),
    ("Practical example","A boutique ad will open on the supplied shirt image and close on an approved shirt-and-logo composition with space for the shopping message."),
    ("Business benefit","Better control of the first impression and final call to action."),
    ("Delivery consideration","We will enable this only where the selected Vercel video capability supports both frames. Unsupported combinations will remain unavailable."),
],("Higgsfield AI Video - first and last image references","https://higgsfield.ai/ai-video"))
card(427,149,"A","Gold Jewelry Advertisement",[
    ("Planned template","We will create 8-, 15- and 20-second silent recipes using one uploaded jewelry photo. The direction will combine close product details, controlled highlights and flowing luxury movement while preserving the supplied jewelry."),
    ("Practical example","A gold retailer will upload a necklace set and create a premium portrait ad focused on its visible craftsmanship."),
])
card(591,172,"B","Luxury Gift Reveal",[
    ("Planned template","We will create 8-, 15- and 20-second silent recipes using one uploaded gift-package photo. The sequence will show a believable opening, a closer look at the supplied contents and a gift-ready closing composition."),
    ("Practical example","A chocolate shop will upload its open gift box. The planned ad will begin with the package closed and reveal the same contents, subject to a clear, supported opening mechanism."),
])
finish(2)

start("Custom-form ads and delivery", "Two additional ad templates with inputs tailored to each concept")
card(141,170,"C+D","Two custom-form advertising templates",[
    ("Planned templates","We will create <b>Product With Model Ad</b> and one additional custom-form ad template, with the second concept agreed during scope confirmation. Each will collect only the details needed for that ad."),
    ("Practical example","For a handbag ad, the customer will add bag photos, select a presenter or upload approved model references, choose a supported action, and enter brand details, an optional offer and a closing message."),
])
card(326,236,"+","Dynamic forms and a reusable brand kit",[
    ("What we will build","For the two custom-form templates, we will add role-specific product and model inputs and relevant style, setting and message fields. Brand details such as logo, colors, tagline, audience and confirmed selling points can be saved for reuse."),
    ("Simple customer journey","For these custom templates: Choose template > Add the requested details > Review > Generate. Product With Model Ad will have 8-, 15- and 20-second silent, 9:16 options, subject to capability validation."),
    ("Scope boundary","These additional fields apply only to the two custom-form templates. The separate Adstudio UGC form requires only one product image. Existing forms remain unchanged. AI features use the existing Vercel API only; no additional AI provider account is included."),
])
card(574,190,"05","UI/UX improvements across the platform",[
    ("What we will update","We will improve the look, clarity and usability of key customer-facing screens and journeys across the platform, including template selection, campaign setup, Adstudio, project review and checkout."),
    ("Design scope","Responsive layouts for mobile and desktop, with Arabic and English screens. Updates will provide clearer hierarchy, navigation, forms and status feedback throughout the customer journey."),
])
finish(3)

start("Payment integration", "Integration of the agreed gateway into the customer purchase flow")
card(144,190,"$","Payment gateway integration",[
    ("What we will build","We will integrate a payment gateway selected with the client, including the checkout handoff and payment success or failure confirmation needed for the agreed purchase flow."),
    ("Delivery consideration","Gateway account approval, transaction fees and provider-specific requirements are subject to the selected provider. Provider selection and merchant setup will be confirmed with the client."),
])
finish(4)

start("Detailed two-week timeline", "Phased work plan with day ranges across the two-week pilot")
timeline = [
    ("Days 1-2", "Kickoff and scope confirmation", "Confirm the second template concept, gateway selection, assets, approvals and pilot priorities."),
    ("Days 3-5", "UI/UX improvements and design", "Map and update key customer journeys and screens; review responsive Arabic and English designs with the client."),
    ("Days 6-8", "Adstudio, templates and brand kit", "Build the one-image Adstudio flow, Product With Model Ad, the agreed second template, custom forms and reusable brand details."),
    ("Days 9-10", "Payment and generation integration", "Connect the agreed gateway and integrate templates with available Vercel capabilities and supported frame controls."),
    ("Days 11-12", "Quality testing and refinements", "Validate outputs, product facts, Arabic and English, mobile and desktop screens, and payment success and failure scenarios."),
    ("Days 13-14", "Client review and pilot handoff", "Walk through the pilot, resolve agreed priority refinements, confirm the scoped delivery and outline next steps."),
]
top = 144
height = 590
x = 44
width = W - 88
c.setStrokeColor(LINE); c.setFillColor(white)
c.roundRect(x, H-top-height, width, height, 12, stroke=1, fill=1)
para("TARGET: 2 WEEKS", x+18, top+14, width-36, "label")
row_top = top + 38
row_height = 84
for index, (day_range, heading, detail) in enumerate(timeline):
    if index:
        c.setStrokeColor(LINE)
        c.line(x+18, H-row_top, x+width-18, H-row_top)
    c.setFillColor(PALE)
    c.roundRect(x+18, H-row_top-39, 72, 25, 5, fill=1, stroke=0)
    c.setFillColor(TEAL)
    c.setFont("Arial-Bold", 8)
    c.drawCentredString(x+54, H-row_top-30, day_range)
    para(f"<b>{heading}</b>", x+102, row_top+3, width-122, "body")
    para(detail, x+102, row_top+20, width-122, "small")
    row_top += row_height
assert row_top <= top+height, row_top
para("Timing assumes prompt client approvals, ready campaign assets and gateway access. Third-party onboarding, scope changes or unsupported generation capabilities may shift the schedule.", 44, top+height+9, W-88, "small")
finish(5)
c.save()
print(DEST)
