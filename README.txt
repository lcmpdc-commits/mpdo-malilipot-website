MPDO MALILIPOT WEBSITE V9 – CMS PREVIEW PACKAGE

This package is based on the V9 Initial Public Launch website. It adds a first-stage administrator CMS for homepage text and public resource uploads.

WEBSITE FILES
- index.html: Homepage
- planning-desk.html: Planning Desk
- cso-desk.html: CSO Desk
- zoning.html: Zoning Administration
- projects.html: Development Projects
- admin.html: Administrator content manager (open at /admin.html)
- site-content.js: Loads published text and resource links
- admin-cms.js: CMS interface logic
- assets/: Municipal Hall photo and MPDO logo concept
- mpdo-admin-worker-r2.js: Cloudflare Worker API source (deploy separately; do NOT upload this file as part of the Pages website)

IMPORTANT
- Do not overwrite the current official website or the existing working V9 test deployment.
- Deploy this package only as a NEW Cloudflare Pages Preview deployment/project for testing.
- The MPDO logo is a design concept, not an officially adopted seal.
- The Municipal Hall photo was supplied by the user.
- Official plans, CSO requirements, zoning rules, and project records remain placeholders pending verification and official upload.
- Keep a local backup of the original ZIP and every updated package.

CLOUDFLARE PAGES PREVIEW
1. Extract this ZIP locally.
2. In Cloudflare Pages, use Direct Upload to create a separate test deployment/project. Upload the extracted website folder contents (index.html, other HTML/JS files, and assets folder) or a ZIP of those contents, according to the Direct Upload screen.
3. Do not choose Production for the official mpdo-malilipot.pages.dev project. Use a separate test project/deployment.
4. The CMS admin page is /admin.html.

WORKER SETUP – REQUIRED FOR LOGIN, CONTENT SAVING, AND UPLOADS
The existing Worker is at https://mpdc-admin.lcmpdc.workers.dev. Before replacing its code, save a backup of the current Worker source.
1. Open the existing Worker in Cloudflare Dashboard > Workers & Pages > mpdc-admin > Edit code.
2. Replace the Worker code with the contents of mpdo-admin-worker-r2.js and deploy the Worker.
3. Keep the existing ADMIN_PASSWORD secret and MPDO_CONTENT KV binding.
4. Create an R2 bucket (for example: mpdo-public-files) and add a Worker R2 binding named MPDO_FILES pointing to that bucket.
5. Save and deploy. Do not remove or rename existing bindings or secrets.
6. The Worker permits HTTPS origins at mpdo-malilipot.pages.dev and its subdomains. Confirm the actual preview hostname; if it is not a subdomain of mpdo-malilipot.pages.dev, add that exact hostname to allowedOrigin() in the Worker source before deploying.

TESTING
1. Open the NEW preview website and visit /admin.html.
2. Test administrator login.
3. Change a harmless homepage heading and save; refresh the public homepage to confirm.
4. Upload one non-confidential test JPG or PDF (maximum 10 MB), choose its section, then save the resource list.
5. Open the matching Planning/CSO/Zoning/Projects page and verify the resource link works.
6. Test sign-out and sign-in again.
7. Do not upload personal, confidential, or sensitive records.

LIMITATIONS OF THIS FIRST CMS PHASE
- Editable homepage text fields and resource uploads/listing are included.
- The first version does not yet provide full page-layout editing, card management, deletion of R2 objects, or a document approval workflow.
- Removing a resource from the published list only removes its public link; the R2 object remains stored until separately deleted by an administrator with appropriate access.
- Uploads require the MPDO_FILES R2 binding. Without it, the upload endpoint returns a clear configuration error.
- Do not promote to the official domain until the preview and Worker are fully tested.


OFFICE ACTIVITIES & ACCOMPLISHMENTS
The public site now includes activities.html. Authorized admins can add activity title, date, category, description, and approved-public attachments from the CMS. Only files approved for public release should be uploaded. Confidential/internal MOVs are not supported in this public archive. File uploads require the Worker MPDO_FILES R2 binding; metadata-only activity publishing uses the existing MPDO_CONTENT KV.
