# Email Client for AWS S3 and SES

<p align="center">
  <strong>A lightweight, cross-platform desktop email client built on AWS S3 and Amazon SES.</strong><br>
  Host and manage unlimited custom-domain email addresses at virtually zero cost ($0.00 / month).
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-34+-47848F?logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/AWS-S3%20%26%20SES-FF9900?logo=amazonaws&logoColor=white" alt="AWS" />
</p>

---

## 📖 Table of Contents
1. [Overview & Why Use This?](#-overview--why-use-this)
2. [Key Features](#-key-features)
3. [AWS Setup Guide: Custom Domain Email for $0 / Month](#-aws-setup-guide-custom-domain-email-for-0--month)
   - [Step 1: Verify Domain Identity in Amazon SES](#step-1-verify-domain-identity-in-amazon-ses)
   - [Step 2: Configure Inbound MX & SPF/DMARC DNS Records](#step-2-configure-inbound-mx--spfdmarc-dns-records)
   - [Step 3: Create S3 Bucket & SES Inbound Receipt Rule](#step-3-create-s3-bucket--ses-inbound-receipt-rule)
   - [Step 4: Configure Outbound SMTP Credentials in Amazon SES](#step-4-configure-outbound-smtp-credentials-in-amazon-ses)
   - [Step 5: Create IAM User & Permissions Policy for the Client](#step-5-create-iam-user--permissions-policy-for-the-client)
4. [In-App Configuration](#-in-app-configuration)
5. [Development & Build Instructions](#-development--build-instructions)
6. [Security & Privacy Model](#-security--privacy-model)

---

## 💡 Overview & Why Use This?

Traditional email hosting providers (Google Workspace, Microsoft 365, ProtonMail) charge **\$6 to \$18/month per mailbox**. If you own multiple domains or need catch-all addresses (`support@`, `billing@`, `me@`, etc.), costs scale quickly.

**Email Client for AWS S3 and SES** turns standard AWS infrastructure into a personal email server:
- **Inbound**: Amazon Simple Email Service (SES) receives incoming emails for your domain and writes raw `.eml` files into an Amazon S3 bucket (at ~\$0.0001 per message).
- **Client**: This desktop app connects directly to your S3 bucket, parses MIME headers and HTML bodies, displays attachments, organizes folders, and auto-polls for new messages.
- **Outbound**: Emails are sent via Amazon SES SMTP (or any standard SMTP server) with outgoing messages automatically saved to `s3://<bucket>/sent/`.

---

## ✨ Key Features

- **Direct S3 Integration**: Native AWS SDK v3 connection running in the Electron Main process (no proxy servers, no CORS modifications required).
- **Full MIME & HTML Engine**: Sanitized HTML email rendering with DOMPurify, inline CID image resolution, plain text fallback, and privacy-preserving remote image toggle.
- **Attachment Drawer**: Multi-part attachment inspector with file previews and native save-to-disk dialogs.
- **Multi-Folder Navigation**:
  - **Inbox**: Incoming messages (automatically excludes sent & trash prefixes).
  - **Sent Mail**: Outgoing emails automatically compiled into RFC 822 `.eml` and saved to `s3://<bucket>/sent/`.
  - **Trash**: Two-stage deletion (moving to `trash/` prefix or permanent S3 deletion).
- **Outgoing Email Composer**:
  - Compose new emails with attachment picker & drag-and-drop.
  - **Reply**, **Reply All**, and **Forward** with pre-filled quoted bodies, `In-Reply-To`, and `References` headers.
- **Auto-Refresh & Live Countdown**:
  - Configurable background polling intervals (30s, 1m, 2m, 5m, 10m).
  - Live ticking timer displayed directly on the **Refresh** button (e.g. `Refresh (45s)`).
- **Multi-Window Email Viewer**: Open emails into standalone native windows.
- **Cross-Platform**: Built for macOS (`.dmg`, `.zip`), Windows (`.exe` NSIS & Portable), and Linux (`.AppImage`, `.deb`, `.tar.gz`).

---

## 🛠 AWS Setup Guide: Custom Domain Email for $0 / Month

Follow these 5 steps to configure your AWS account and DNS provider.

### Step 1: Verify Domain Identity in Amazon SES

1. Open the [Amazon SES Console](https://console.aws.amazon.com/ses/).
2. Select your desired AWS Region (e.g., `eu-west-1` Ireland, `us-east-1` N. Virginia, or `us-west-2` Oregon).
3. In the left navigation, click **Identities** $\rightarrow$ **Create identity**.
4. Select **Domain** and enter your domain name (e.g., `yourdomain.com`).
5. Under **Easy DKIM**, keep the default (RSA 2048-bit) and click **Create identity**.
6. SES will generate **3 CNAME records** for DKIM. Copy and add these 3 CNAME records to your DNS provider (Cloudflare, Route 53, Namecheap, GoDaddy, etc.).
7. Once DNS propagates, status will change to **Verified**.

---

### Step 2: Configure Inbound MX & SPF/DMARC DNS Records

Add the following DNS records in your DNS manager for your domain:

#### 1. Inbound MX Record
Amazon SES receives incoming emails using regional inbound SMTP endpoints:

| Record Type | Name / Host | Priority | Value / Destination | Region |
| :--- | :--- | :--- | :--- | :--- |
| **MX** | `@` (or root) | `10` | `inbound-smtp.eu-west-1.amazonaws.com` | EU (Ireland) |
| **MX** | `@` (or root) | `10` | `inbound-smtp.us-east-1.amazonaws.com` | US East (N. Virginia) |
| **MX** | `@` (or root) | `10` | `inbound-smtp.us-west-2.amazonaws.com` | US West (Oregon) |

*(Choose the endpoint matching the SES region you selected in Step 1).*

#### 2. SPF Record (TXT)
Add an SPF record to authorize SES to send on behalf of your domain:
```text
Type:  TXT
Name:  @ (or yourdomain.com)
Value: v=spf1 include:amazonses.com ~all
```

#### 3. DMARC Record (TXT)
Add a basic DMARC policy for email deliverability:
```text
Type:  TXT
Name:  _dmarc
Value: v=DMARC1; p=none;
```

---

### Step 3: Create S3 Bucket & SES Inbound Receipt Rule

#### 1. Create S3 Bucket
1. Open the [Amazon S3 Console](https://console.aws.amazon.com/s3/).
2. Click **Create bucket**.
3. Name your bucket (e.g., `my-custom-domain-emails`) in the **same region** as your SES identity.
4. Keep **Block all public access** enabled (Bucket remains completely private).
5. Click **Create bucket**.

#### 2. Add S3 Bucket Policy for SES Access
1. Go to your bucket $\rightarrow$ **Permissions** tab $\rightarrow$ **Bucket policy** $\rightarrow$ **Edit**.
2. Paste the following policy (replace `my-custom-domain-emails` and `123456789012` with your bucket name and AWS Account ID):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSESPuts",
      "Effect": "Allow",
      "Principal": {
        "Service": "ses.amazonaws.com"
      },
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::my-custom-domain-emails/*",
      "Condition": {
        "StringEquals": {
          "aws:SourceAccount": "123456789012"
        }
      }
    }
  ]
}
```

#### 3. Configure SES Email Receiving Rule Set
1. In the Amazon SES console, navigate to **Email receiving** (under Configuration).
2. If no Rule Set is active, click **Create rule set** (e.g., name it `default-inbound`) and click **Set as active rule set**.
3. Click **Create rule**:
   - **Rule name**: `save-to-s3`
   - **Recipient conditions**: Leave empty to catch **all** incoming emails for your verified domain (catch-all), or specify recipient addresses (e.g., `me@yourdomain.com`).
   - **Actions**: Click **Add action** $\rightarrow$ select **Deliver to S3 bucket**.
   - **S3 bucket**: Select your newly created bucket (`my-custom-domain-emails`).
   - **Object key prefix**: Leave empty (root) or set `incoming/`.
4. Click **Next** $\rightarrow$ **Create rule**.

> 🎉 **Inbound email is now active!** Any email sent to `anything@yourdomain.com` will immediately land as a raw `.eml` file in your S3 bucket.

---

### Step 4: Configure Outbound SMTP Credentials in Amazon SES

1. In the Amazon SES Console, navigate to **Account dashboard** (or **SMTP settings**).
2. Note your **SMTP endpoint** (e.g., `email-smtp.eu-west-1.amazonaws.com`) and port (`587` for STARTTLS, `465` for TLS).
3. Click **Create SMTP credentials**.
4. Enter an IAM User Name (e.g., `ses-smtp-user`) and click **Create user**.
5. Copy the generated **SMTP Username** and **SMTP Password** (these are distinct from AWS Access Keys).

> [!NOTE]
> **SES Sandbox Note**: New AWS accounts are initially placed in the *SES Sandbox*, which allows sending only to verified email addresses. To send to anyone, click **Request production access** on the SES Account dashboard (requests are typically approved within a few hours).

---

### Step 5: Create IAM User & Permissions Policy for the Client

To allow this desktop client to read, write, and delete emails from your S3 bucket:

1. Open the [AWS IAM Console](https://console.aws.amazon.com/iam/) $\rightarrow$ **Users** $\rightarrow$ **Create user** (e.g., `s3-email-client-app`).
2. Select **Attach policies directly** $\rightarrow$ click **Create policy** (JSON):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3EmailClientAccess",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::my-custom-domain-emails",
        "arn:aws:s3:::my-custom-domain-emails/*"
      ]
    }
  ]
}
```

3. Complete user creation, navigate to the **Security credentials** tab $\rightarrow$ **Create access key** $\rightarrow$ choose **Application running outside AWS**.
4. Copy your **Access Key ID** and **Secret Access Key**.

---

## ⚙️ In-App Configuration

When you launch **S3 Email Client**, open **Settings** (top right gear icon):

### 1. AWS S3 (Incoming Mail) Tab
- **Bucket Name**: `my-custom-domain-emails`
- **Region**: Select your AWS Region (e.g., `eu-west-1`)
- **Access Key ID**: `AKIA...` (from Step 5)
- **Secret Access Key**: `...` (from Step 5)
- **Prefix**: `incoming/` (or leave empty if using root bucket)
- **Automatic Background Refresh**: Toggle Enabled (default: `true`)
- **Refresh Interval**: Select interval (e.g., `1 minute`)
- **Show countdown on Refresh button**: Toggle Enabled (`Refresh (45s)`)
- Click **"Test AWS S3 Connection"** $\rightarrow$ **"Save Configuration"**.

### 2. SMTP (Outgoing Mail) Tab (Optional)
- **Host**: `email-smtp.eu-west-1.amazonaws.com` (from Step 4)
- **Port**: `587` (STARTTLS) or `465` (SSL)
- **Username**: `AKIA...` (SES SMTP Username)
- **Password**: `...` (SES SMTP Password)
- **From Name**: `Your Name`
- **From Email**: `me@yourdomain.com`
- Click **"Test SMTP Connection"** $\rightarrow$ **"Save Configuration"**.

---

## 💻 Development & Build Instructions

### Prerequisites
- Node.js 20.x or higher
- npm 10.x or higher

### Development Mode
```bash
# Install dependencies
npm install

# Start Electron + Vite with Hot-Reload
npm run dev
```

### Packaging Desktop Binaries

Packaged installers and executables are placed in the `release/` folder:

```bash
# Package for macOS (.dmg and .zip)
npm run dist:mac

# Package for Windows (.exe NSIS Installer and standalone Portable)
npm run dist:win

# Package for Linux (.AppImage, .deb, .tar.gz)
npm run dist:linux

# Package for all platforms
npm run dist:all
```

---

## 🔒 Security & Privacy Model

- **Zero Third-Party Relays**: All S3 operations and SMTP requests occur directly between your computer and your AWS account. No intermediate proxy servers, telemetries, or analytics are used.
- **Process Isolation**: Electron context isolation is strictly enforced (`contextIsolation: true`, `nodeIntegration: false`). Secrets and AWS SDK calls are restricted to the Main process.
- **HTML Sanitization**: Emails are sanitized via `DOMPurify` before rendering inside sandboxed `<iframe>` elements with disabled script execution.
- **Remote Content Blocker**: Remote images and tracking pixels are blocked by default with a one-click banner toggle to reveal them per email.

---

## 📄 License

MIT License. Feel free to use, modify, and distribute for personal or commercial email management.

