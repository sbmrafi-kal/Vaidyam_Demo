# Vaidyam Magazine Shopify Theme — Content Map

This document maps all editorial content, recurring sections, static pages, and components for the **Kerala Ayurveda Vaidyam** site MVP.

---

## 1. Landing Page Architecture (`sections/main-vaidyam.liquid`)

| Section Block | Component Name | Description | Source Reference |
|---|---|---|---|
| `hero` | **Hero Section** | Eyebrow, headline, subtitle, Subscribe & Read Free CTAs, trust stats, magazine cover artwork, and 18-section badge. | `Website content - Vaidyam.docx` |
| `about` | **About Vaidyam** | 3 core pillars: Expert Insights, Curated Diversity, Practical Wisdom. | `Website content - Vaidyam.docx` |
| `current_edition` | **Current Edition** | Vol VIII Issue 4 (Oct–Dec 2025), Thyroid special feature, Print Only pricing (₹700), Purchase CTA. | Homepage mockups |
| `care_paths` | **Care Paths** | 6 specialized clinical care pathways (Agni/Gut, Keshya/Scalp, Manas/Stress, Sandhi/Joints, Thyroid, Stree Roga). | Senior approved |
| `topics` | **Knowledge Domains** | 8 visual category cards with botanical asset illustrations. | Senior approved |
| `through_pages` | **Through The Pages** | 4 featured category cards: Vaidya Voice, Case of the trimonth, Śāstramathanam, Vox-Populi. | `Vaidyam_ Section descriptions (1).docx` |
| `all_sections` | **All 18 Recurring Sections** | Complete grid with titles, descriptions, and Google Open Source SVG icons for all 18 recurring columns. | `Vaidyam_ Section descriptions (1).docx` |
| `by_concern` | **By Concern** | Clinical article spotlight (*Triphala in Clinical Practice* by Dr. Nimin Sreedhar). | `Website content - Vaidyam.docx` |
| `video` | **Ayurveda in Action** | Embedded video player for *"Is Ayurveda a Pseudoscience?"* by Kerala Ayurveda Vaidyam. | YouTube channel |
| `testimonials` | **What Our Readers Say** | Interactive carousel with ratings and quotes from 4 practicing physicians (Dr. Rajesh B., Dr. Arun P. V., Dr. Anand R. V., Dr. Arjun M.). | `Website content - Vaidyam.docx` |
| `our_legacy` | **Our Legacy** | Founders' heritage narrative and 3 core pillars (Impart, Contextualise, Support). | `Website content - Vaidyam.docx` |
| `contact_info` | **Subscribe & Contact CTA** | Subscription information (₹1200/yr), phone line, publication office address, and social links. | `Website content - Vaidyam.docx` |

---

## 2. Static Pages & Templates

- **About / Legacy Page:** [`templates/page.about.json`](file:///Users/rafi/Downloads/drive-download-20260819T163430Z-1-001/Vaidyam_Demo/templates/page.about.json) &rarr; [`sections/main-about-vaidyam.liquid`](file:///Users/rafi/Downloads/drive-download-20260819T163430Z-1-001/Vaidyam_Demo/sections/main-about-vaidyam.liquid)
- **Editorial Board Page:** [`templates/page.editorial-board.json`](file:///Users/rafi/Downloads/drive-download-20260819T163430Z-1-001/Vaidyam_Demo/templates/page.editorial-board.json) &rarr; [`sections/main-editorial-board.liquid`](file:///Users/rafi/Downloads/drive-download-20260819T163430Z-1-001/Vaidyam_Demo/sections/main-editorial-board.liquid)
- **Submission Guidelines Page:** [`templates/page.guidelines.json`](file:///Users/rafi/Downloads/drive-download-20260819T163430Z-1-001/Vaidyam_Demo/templates/page.guidelines.json) &rarr; [`sections/main-guidelines.liquid`](file:///Users/rafi/Downloads/drive-download-20260819T163430Z-1-001/Vaidyam_Demo/sections/main-guidelines.liquid)
- **Contact Page:** [`templates/page.contact.json`](file:///Users/rafi/Downloads/drive-download-20260819T163430Z-1-001/Vaidyam_Demo/templates/page.contact.json) &rarr; [`sections/main-contact-vaidyam.liquid`](file:///Users/rafi/Downloads/drive-download-20260819T163430Z-1-001/Vaidyam_Demo/sections/main-contact-vaidyam.liquid)
