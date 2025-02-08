// Custom type declarations for sharp
import * as sharp from 'sharp';

declare module 'sharp' {
  // Extend existing types or add custom type extensions here
  export interface SharpOptions {
    // Add any custom options or extensions
    customProcessing?: boolean;
  }

  // Custom method example
  export function enhancedResize(
    width: number, 
    height: number, 
    options?: SharpOptions
  ): sharp.Sharp;

  // Extend the Sharp class with custom methods
  interface Sharp {
    // Example of adding a custom method
    customOptimize(): Sharp;
  }
}
