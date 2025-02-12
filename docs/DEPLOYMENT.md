# Deployment Instructions for Render

## License System Setup

Since the application now includes a hardware-locked licensing system, deployment requires special consideration:

1. **Generate Deployment License**

On your administrator machine (where you have COMPANY_SECRET), generate a special license for the deployment:

```bash
# Generate a deployment license
npm run license:generate "deployment" "Render Server" "your-admin-email" "Production"
```

2. **Configure Render Environment Variables**

In the Render Dashboard:
1. Go to your service
2. Navigate to "Environment"
3. Add these required variables:
   - `COMPANY_SECRET`: Your admin COMPANY_SECRET
   - `LICENSE_KEY`: The license key generated for deployment
   - Add all other environment variables from .env.example

## Important Notes

1. **Hardware Lock Considerations**
   - Each Render deployment instance may need a new license if Render changes the underlying hardware
   - If you see license validation errors in logs, generate and update a new license
   - Monitor the logs for any license-related issues

2. **Auto-Deploy Settings**
   - Auto-deploy is enabled in render.yaml
   - New deployments will use the existing LICENSE_KEY
   - If hardware changes cause license validation failures, you'll need to:
     1. Generate a new license
     2. Update LICENSE_KEY in Render dashboard
     3. Redeploy the application

3. **Security**
   - Never commit any license files (.license, .admin-fingerprint)
   - Keep COMPANY_SECRET secure
   - Use environment variables for all sensitive data
   - The render.yaml file is configured to not sync sensitive values

## Deployment Steps

1. **Initial Deployment**
```bash
# On your admin machine
npm run license:generate "deployment" "Render Server" "your-admin-email" "Production"
```

2. **Render Setup**
- Create new Web Service
- Connect to your GitHub repository
- Use settings from render.yaml
- Add environment variables
- Deploy

3. **Verify Deployment**
- Check logs for successful license validation
- Monitor for any hardware-related license issues
- Test all functionality

## Troubleshooting

1. **License Validation Errors**
```
Error: Invalid hardware configuration
```
Solution: Generate new license and update LICENSE_KEY in Render dashboard

2. **Missing Environment Variables**
```
Error: COMPANY_SECRET not found
```
Solution: Check all required variables are set in Render dashboard

3. **Hardware Changes**
If Render migrates your service to different hardware:
1. Watch logs for license validation errors
2. Generate new license with your admin machine
3. Update LICENSE_KEY in Render
4. Redeploy application

## Monitoring

Monitor these aspects of your deployment:
1. License validation in startup logs
2. Any hardware-related errors
3. License expiration dates
4. Service uptime and performance

## Best Practices

1. **License Management**
   - Keep record of all deployment licenses
   - Monitor expiration dates
   - Have process for quick license updates

2. **Environment Variables**
   - Use Render's environment variable management
   - Never commit sensitive data
   - Keep local .env for development

3. **Deployment Process**
   - Test changes locally first
   - Monitor deployment logs
   - Have rollback plan ready

4. **Security**
   - Regular security audits
   - Monitor access logs
   - Keep dependencies updated

## Upgrading

When upgrading the application:
1. Test locally first
2. Check if license system changes require new license
3. Deploy to staging if available
4. Monitor logs during and after deployment
