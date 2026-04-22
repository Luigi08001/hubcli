# CMS Setup Guide

> See also: [[PORTAL_SETUP]] · [[MARKETING_SETUP]] · [[COMMAND_TREE]]

Complete configuration guide for HubSpot CMS Hub settings. Covers domains, templates, blog, pages, file management, and developer tools.

**Prerequisites:**
- Portal authenticated (`hscli auth whoami`)
- Private App scopes: `content`, `cms.domains.read/write`
- Domain DNS access (see [PORTAL_SETUP.md](./PORTAL_SETUP.md))

---

## 1. Domains & URLs

**Where:** Settings > Content > Domains & URLs

### 1.1 Domain Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Primary domain | Main website domain (e.g., `www.yourcompany.com`) | Primary content hosting |
| Redirect domains | Non-www → www (or vice versa) | Prevent duplicate content |
| Landing page domain | Separate subdomain (e.g., `go.yourcompany.com`) | Campaign landing pages |
| Blog domain | Subdomain or path (e.g., `blog.yourcompany.com` or `/blog`) | Blog content hosting |
| Knowledge base domain | Subdomain (e.g., `help.yourcompany.com`) | Customer self-service |
| Email domain | For email web version links | Consistent branding |
| SSL certificate | Auto-provisioned by HubSpot | HTTPS security (automatic) |

### 1.2 URL Mappings

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| URL redirects | Old URL → new URL (301/302) | SEO preservation, prevent broken links |
| Trailing slash | Consistent trailing slash policy | SEO and canonical URL consistency |
| Lowercase URLs | Force lowercase | Prevent duplicate content |
| Language slug | `/en/`, `/fr/` path prefix for multi-language | Internationalized URLs |

> **API:** URL redirects can be managed via the URL Redirects API.

**hscli:**
```bash
# List domains
hscli cms domains list

# List URL redirects
hscli cms url-redirects list --limit 20

# Create a URL redirect
hscli cms url-redirects create --data '{
  "routePrefix": "/old-page",
  "destination": "/new-page",
  "redirectStyle": 301
}' --force
```

---

## 2. Templates & Themes

**Where:** Design Manager (Marketing > Files and Templates > Design Tools)

### 2.1 Theme Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Active theme | Select or install theme | Base design for all pages |
| Theme settings | Colors, fonts, spacing, layout | Global brand consistency |
| Global header | Navigation, logo, CTA button | Consistent site navigation |
| Global footer | Links, social icons, legal text | Consistent footer across pages |
| Favicon | Small icon for browser tabs | Brand recognition |

### 2.2 Template Types

| Template type | Purpose | Example |
|---------------|---------|---------|
| Website page | Standard pages | About, Contact, Pricing |
| Landing page | Campaign pages (no nav) | Offer pages, event registration |
| Blog listing | Blog index page | Blog home |
| Blog post | Individual blog posts | Article layout |
| System page | Error, password, subscription | 404 page, email preference center |
| Email | Marketing emails | Newsletter template |

### 2.3 Custom Modules

| Element | Configuration | Purpose |
|---------|--------------|---------|
| Custom modules | Reusable content blocks in Design Manager | Consistent components across pages |
| Module fields | Configurable options (text, image, color, link) | Content editors can customize without code |
| Global modules | Shared across all pages/templates | Update once, apply everywhere (header, footer) |
| Module groups | Organize related modules | Clean design manager |

---

## 3. Blog

**Where:** Marketing > Blog | Settings > Content > Blog

### 3.1 Blog Settings

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Blog name | Blog title (e.g., "Company Blog") | Appears in RSS, SEO |
| Blog root URL | Path (e.g., `/blog`) | SEO-friendly URL structure |
| Posts per page | Number of posts on listing page (10–20) | Page load and UX |
| Comment settings | Allow/moderate/disable comments | Community engagement |
| Social sharing | Enable share buttons | Content distribution |
| Subscription | Allow email subscription to blog | Audience building |
| Notification email | Email sent to subscribers for new posts | Content distribution |
| RSS feed | Auto-generated RSS | Syndication |
| Author pages | Enable/disable author listing pages | SEO and attribution |
| Tag pages | Enable/disable tag listing pages | Content organization |

### 3.2 Blog SEO Defaults

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Meta title format | `{post_title} | {blog_name}` | SEO consistency |
| Meta description | Auto or manual per post | Search engine display |
| Canonical URL | Auto-set to post URL | Prevent duplicate content |
| Featured image | Required for social sharing | Social media cards |
| Structured data | Article schema (auto by HubSpot) | Rich search results |

**hscli:**
```bash
# List blog posts
hscli cms blog-posts list --limit 20

# Get blog post details
hscli cms blog-posts get <blogPostId>

# Create a blog post
hscli cms blog-posts create --data '{
  "name": "How to Get Started",
  "slug": "how-to-get-started",
  "contentGroupId": "<blogId>",
  "postBody": "<p>Your content here</p>",
  "metaDescription": "Learn how to get started with our platform."
}' --force
```

---

## 4. Website Pages

**Where:** Marketing > Website Pages | Settings > Content > Pages

### 4.1 Page Settings

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Default template | Template for new pages | Consistency |
| Page title suffix | Appended to all page titles (e.g., `| Company Name`) | SEO branding |
| Robots.txt | Custom robots.txt rules | Search engine crawling control |
| Sitemap | Auto-generated sitemap | Search engine discovery |
| 404 page | Custom 404 error page | User experience |
| Password protection | Protect pages behind password | Gated content |
| IP restrictions | Restrict access by IP (staging/internal) | Pre-launch security |

### 4.2 Page Optimization

| Feature | Configuration | Purpose |
|---------|--------------|---------|
| SEO recommendations | Per-page SEO audit | Improve search ranking |
| A/B testing | Test page variations | Optimize conversions |
| Smart content | Personalized content per segment | Targeted messaging |
| CTAs | Call-to-action buttons with tracking | Conversion tracking |
| Lazy loading | Auto-enabled for images | Page speed |
| Minification | Auto CSS/JS minification | Page speed |

**hscli:**
```bash
# List website pages
hscli cms pages list --limit 20

# Get page details
hscli cms pages get <pageId>
```

---

## 5. File Manager

**Where:** Marketing > Files and Templates > Files

### 5.1 File Organization

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Folder structure | Organize by type (images, documents, videos) | Easy asset discovery |
| File naming | Consistent naming convention | SEO and organization |
| Image optimization | Auto-resize/compress on upload | Page performance |
| CDN delivery | Automatic via HubSpot CDN | Fast global delivery |
| File visibility | Public or private (requires auth) | Access control |

### 5.2 File Types

| Category | Supported formats | Max size |
|----------|-------------------|----------|
| Images | JPG, PNG, GIF, SVG, WebP | 20 MB |
| Documents | PDF, DOC, DOCX, XLS, PPT | 300 MB |
| Videos | MP4, MOV, AVI (hosted) | 1 GB (CMS Hub) |
| Audio | MP3, WAV | 300 MB |
| Code | JS, CSS | 300 MB |

**hscli:**
```bash
# List files
hscli cms files list --limit 20

# Upload a file
hscli cms files upload --file ./logo.png --folder-path /images/branding

# Get file details
hscli cms files get <fileId>
```

---

## 6. Multi-Language Content

**Where:** Settings > Content > Language Settings

### 6.1 Language Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Primary language | Main content language | Default for all content |
| Additional languages | Languages to support | Multi-language variations |
| Language switcher | Show language selector on pages | User can switch language |
| URL format | Subdirectory (`/fr/`) or subdomain (`fr.example.com`) | SEO for international |
| Hreflang tags | Auto-generated by HubSpot | Search engine language targeting |
| Translation workflow | Who translates + approval process | Quality control |

---

## 7. Developer Tools

**Where:** Design Manager + Developer File System

### 7.1 HubSpot CLI (Developer)

| Tool | Command | Purpose |
|------|---------|---------|
| Fetch theme | `hs fetch <account> <src> <dest>` | Download theme files locally |
| Upload | `hs upload <src> <dest>` | Push local changes to HubSpot |
| Watch | `hs watch <src> <dest>` | Auto-upload on file change |
| Create | `hs create <type>` | Scaffold modules, templates |
| Sandbox | `hs sandbox create` | Create development sandbox |

### 7.2 HubL (Templating Language)

| Feature | Example | Purpose |
|---------|---------|---------|
| Variables | `{{ content.name }}` | Dynamic content |
| Filters | `{{ name\|title }}` | Format output |
| Tags | `{% if condition %}` | Logic in templates |
| Modules | `{% module "cta" %}` | Reusable components |
| Functions | `{{ blog_recent_posts() }}` | Data access |

### 7.3 Serverless Functions

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Function file | `<name>.functions/serverless.json` | Define endpoints |
| Routes | API paths your function responds to | Custom API endpoints |
| Secrets | Environment variables (API keys, etc.) | Secure configuration |
| Runtime | Node.js 18 | Execution environment |
| Rate limits | 600 requests/minute per account | Capacity planning |

---

## 8. Content Staging

**Where:** Content > Content Staging (CMS Hub Professional+)

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Staging sandbox | Clone production pages for redesign | Safe testing environment |
| Staged pages | Select pages to redesign | Control scope of changes |
| Preview | Review staged changes before publish | Quality assurance |
| Publish | Push staged changes live | Go-live process |

---

## Setup Checklist

### Domains
```
[ ] Primary domain connected and SSL verified
[ ] Redirect domain configured (www ↔ non-www)
[ ] Landing page subdomain configured (if separate)
[ ] Blog path/subdomain configured
[ ] URL redirect rules created for any migrated content
```

### Templates & Themes
```
[ ] Theme selected/installed
[ ] Theme settings configured (colors, fonts, spacing)
[ ] Global header configured (logo, navigation)
[ ] Global footer configured (links, social, legal)
[ ] Favicon uploaded
[ ] Custom modules created for reusable components
```

### Blog
```
[ ] Blog settings configured (name, URL, posts per page)
[ ] Comment settings set
[ ] Social sharing enabled
[ ] Blog subscription email configured
[ ] SEO defaults set (title format, meta)
[ ] At least one blog post published
```

### Website Pages
```
[ ] Default page template selected
[ ] Page title suffix configured
[ ] Custom 404 page created
[ ] Robots.txt reviewed
[ ] Sitemap verified
[ ] Key pages created (Home, About, Contact, Pricing)
```

### File Manager
```
[ ] Folder structure created
[ ] Brand assets uploaded (logo, images, icons)
[ ] File naming convention established
```

### Multi-Language (if applicable)
```
[ ] Primary language set
[ ] Additional languages added
[ ] URL format chosen (subdirectory or subdomain)
[ ] Language switcher enabled
[ ] Translation workflow established
```

### Developer Tools
```
[ ] HubSpot CLI installed (`npm install -g @hubspot/cli`)
[ ] CLI authenticated with portal
[ ] Local development workflow established
[ ] Sandbox created for testing (if applicable)
```
