# MyProfile Server

## License Management

This project uses a hardware-locked licensing system. Here's how it works:

### For Administrators (You)

1. Initial Setup:
   ```bash
   # Generate your company secret (do this only once)
   npm run license:generate-secret

   # Save the generated secret in your .env file as COMPANY_SECRET
   # NEVER share this secret or commit it to Git
   ```

2. Generate License for New Employee:
   ```bash
   # This will generate and email the license to the employee
   npm run license:generate <employeeId> "<name>" "<email>" "<department>"

   # Example:
   npm run license:generate "emp123" "John Doe" "john@company.com" "Engineering"
   ```

3. View Licensed Employees:
   ```bash
   npm run license:list
   ```

### For Employees (When downloading from GitHub)

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create .env file and add your LICENSE_KEY:
   ```bash
   # .env file
   LICENSE_KEY=your-license-key-from-email
   ```

4. Start the application:
   ```bash
   npm start
   ```

### Security Notes

1. Administrator Security:
   - Keep your COMPANY_SECRET secure and private
   - Never share COMPANY_SECRET with employees
   - Never commit COMPANY_SECRET to version control
   - Each license you generate is tied to specific hardware

2. Employee Security:
   - Each LICENSE_KEY is hardware-locked to one machine
   - LICENSE_KEY cannot be shared between machines
   - Licenses expire after 1 year from activation
   - Keep your LICENSE_KEY secure

### Important Files (Already in .gitignore)

- `.env` - Contains your COMPANY_SECRET (admin only)
- `.license` - Contains the installed license (generated per machine)
- `.env.license` - License environment variables

## Rest of Your Project Documentation Here...
