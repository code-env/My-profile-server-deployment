// import jwt from 'jsonwebtoken';
// import { User } from '../models/User';
// import { logger } from './logger';
// import { CustomError } from './errors'; 

// interface TokenPayload {
//   userId: string;
//   email: string;
//   type?: string;
// }

// interface AuthTokens {
//   accessToken: string;
//   refreshToken: string;
// }

// export class JWT {
//   private static ACCESS_TOKEN_EXPIRY = '15m'; 
//   private static REFRESH_TOKEN_EXPIRY = '7d'; 

//   // Generate access and refresh tokens
//   public static generateTokens(userId: string, email: string): AuthTokens {
//     const accessToken = jwt.sign({ userId, email }, process.env.JWT_SECRET!, {
//       expiresIn: this.ACCESS_TOKEN_EXPIRY,
//     });

//     const refreshToken = jwt.sign(
//       { userId, email, type: 'refresh' },
//       process.env.JWT_REFRESH_SECRET!,
//       { expiresIn: this.REFRESH_TOKEN_EXPIRY }
//     );

//     return { accessToken, refreshToken };
//   }

//   // Refresh access token using a valid refresh token
//   public static async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
//     try {
//       // Verify the refresh token
//       const decoded = jwt.verify(
//         refreshToken,
//         process.env.JWT_REFRESH_SECRET!
//       ) as TokenPayload;

//       // Ensure the token is a refresh token
//       if (decoded.type !== 'refresh') {
//         throw new CustomError('INVALID_TOKEN', 'Invalid token type');
//       }

//       // Find user and check if refresh token exists
//       const user = await User.findById(decoded.userId);
//       if (!user || !user.refreshTokens?.includes(refreshToken)) {
//         throw new CustomError('INVALID_TOKEN', 'Invalid refresh token');
//       }

//       // Implement refresh token rotation for enhanced security
//       // Remove the used refresh token and generate a new one
//       const newRefreshToken = jwt.sign(
//         { userId: user._id.toString(), email: user.email, type: 'refresh' },
//         process.env.JWT_REFRESH_SECRET!,
//         { expiresIn: this.REFRESH_TOKEN_EXPIRY }
//       );

//       // Generate new access token
//       const accessToken = jwt.sign(
//         { userId: user._id.toString(), email: user.email },
//         process.env.JWT_SECRET!,
//         { expiresIn: this.ACCESS_TOKEN_EXPIRY }
//       );

//       // Update refresh tokens list (implement rotation)
//       user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken);
//       user.refreshTokens.push(newRefreshToken);
//       await user.save();

//       return { accessToken, refreshToken: newRefreshToken };
//     } catch (err) {
//       logger.error('Failed to refresh access token:', err);
//       throw new CustomError('TOKEN_REFRESH_FAILED', 'Failed to refresh access token');
//     }
//   }
// }