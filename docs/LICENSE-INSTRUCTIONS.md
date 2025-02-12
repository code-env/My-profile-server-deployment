# MyProfile License System

## Overview

MyProfile uses a secure, hardware-locked licensing system to protect your intellectual property. The system has two levels of hardware protection:
1. Administrator Machine Lock - Only your specific machine can generate licenses
2. Employee Machine Lock - Each license is tied to the employee's specific hardware

## Administrator Setup (First Time Only)

1. **Initial Machine Registration**
   - The first time you generate a license, your machine is automatically registered as the administrator machine
   - A hardware fingerprint is created and encrypted using your COMPANY_SECRET
   - This fingerprint is stored in `.admin-fingerprint` file
   - NEVER share or commit this file to Git
   - Keep a secure backup of both your COMPANY_SECRET and .admin-fingerprint file

2. **Generate Company Secret** (Do this ONCE)
   ```bash
   npm run license:generate-secret
   ```
   - Save this in YOUR .env file
   - Never share this with anyone
   - This is your master key for generating licenses

3. **Backup Critical Files**
   - Store COMPANY_SECRET in a secure password manager
   - Backup .admin-fingerprint file securely
   - These are required if you need to move to a new administrator machine

## Security Layers

1. **Administrator Protection**
   - Only your machine can generate license keys
   - Even with the source code and COMPANY_SECRET, others cannot generate licenses
   - Hardware-locked to prevent unauthorized license generation
   - Automatic fingerprint verification on every license generation

2. **Employee Protection**
   - Each LICENSE_KEY is hardware-locked to one machine
   - Licenses expire after 1 year
   - Cannot be shared between machines
   - Automatic validation on application startup

## Managing Licenses

1. **Generate Employee License**
   ```bash
   npm run license:generate <employeeId> "<name>" "<email>" "<department>"
   ```
   - Only works on the administrator machine
   - Automatically emails license to employee
   - License is hardware-locked when installed

2. **Monitor Active Licenses**
   ```bash
   npm run license:list
   ```
   - Shows all active licenses
   - Tracks expiration dates
   - Displays hardware fingerprints

## Employee Installation

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd my-profile
   npm install
   ```

2. **Add License**
   - Check email for LICENSE_KEY
   - Add to .env file:
   ```
   LICENSE_KEY=your-license-key
   ```

3. **Start Application**
   ```bash
   npm start
   ```
   - License is automatically validated
   - Hardware fingerprint is verified
   - Expiration date is checked

## Troubleshooting

1. **Administrator Issues**
   - If moving to new machine, need both:
     * COMPANY_SECRET
     * .admin-fingerprint file
   - Contact system administrator if lost

2. **Employee Issues**
   - Invalid license: Check correct machine
   - Expired license: Request renewal
   - Hardware mismatch: Request new license

## Security Best Practices

1. **Protected Files**
   ```
   .env              - Contains COMPANY_SECRET (admin only)
   .admin-fingerprint - Hardware lock for admin machine
   .license          - Employee's installed license
   ```

2. **Never Share**
   - COMPANY_SECRET
   - .admin-fingerprint file
   - Your personal LICENSE_KEY

3. **Version Control**
   - Above files are in .gitignore
   - Never commit sensitive files
   - Each developer needs their own license

## Legal Notes

- License does not grant ownership
- Non-transferable
- Subject to terms of use
- Confidentiality required
