import { licenseManager } from '../utils/license-manager';
import { logger } from '../utils/logger';

class LicenseService {
  /**
   * Validate license key
   */
  public async validateLicense(
    licenseKey: string,
    deviceId: string,
    ipAddress: string
  ): Promise<{
    isValid: boolean;
    error?: string;
    employeeInfo?: {
      name: string;
      email: string;
      department: string;
      employeeId: string;
    };
  }> {
    // Skip validation in production
    if (process.env.NODE_ENV === 'production') {
      return {
        isValid: true,
        employeeInfo: {
          name: 'Production User',
          email: 'production@system.local',
          department: 'Production',
          employeeId: 'PROD-0001'
        }
      };
    }

    try {
      const companySecret = process.env.COMPANY_SECRET;
      if (!companySecret) {
        return { isValid: false, error: 'Missing company secret' };
      }

      // First try validating existing license
      const result = licenseManager.validateLicense(companySecret);

      // If validation fails and we have a new license key, try installing it
      if (!result.isValid && licenseKey) {
        licenseManager.installLicense(licenseKey);
        const newResult = licenseManager.validateLicense(companySecret);
        if (newResult.isValid && newResult.employee) {
          return {
            isValid: true,
            employeeInfo: {
              name: newResult.employee.name,
              email: newResult.employee.email,
              department: newResult.employee.department,
              employeeId: newResult.employee.employeeId
            }
          };
        }
      }

      // Return result of initial validation if no new license was installed
      if (result.isValid && result.employee) {
        return {
          isValid: true,
          employeeInfo: {
            name: result.employee.name,
            email: result.employee.email,
            department: result.employee.department,
            employeeId: result.employee.employeeId
          }
        };
      }

      return {
        isValid: false,
        error: result.error || 'License validation failed'
      };

    } catch (error) {
      logger.error('License validation error:', error);
      return { isValid: false, error: 'License validation error occurred' };
    }
  }
}

export const licenseService = new LicenseService();
