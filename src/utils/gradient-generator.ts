/**
 * Utility functions for generating unique gradient backgrounds
 * Similar to how Telegram generates unique gradients for users without profile pictures
 */

/**
 * Generates a unique HSL color based on a string input
 * @param input The input string to generate a color from
 * @param saturation The saturation value (0-100)
 * @param lightness The lightness value (0-100)
 * @returns An HSL color string
 */
export function generateUniqueColor(
  input: string,
  saturation: number = 75,
  lightness: number = 60
): string {
  // Generate a hash from the input string
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Convert the hash to a hue value (0-360)
  const hue = Math.abs(hash % 360);

  // Return the HSL color string
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Generates a unique gradient background based on a username
 * @param username The username to generate a gradient for
 * @returns A CSS gradient string
 */
export function generateGradientBackground(username: string): string {
  // Generate two colors based on the username
  // We use different saturation and lightness values for the two colors
  // to create a more interesting gradient
  const color1 = generateUniqueColor(username, 75, 65);
  const color2 = generateUniqueColor(username + 'salt', 65, 55);

  // Return a linear gradient
  return `linear-gradient(135deg, ${color1}, ${color2})`;
}

/**
 * Generates a unique gradient background for a profile
 * @param username The username to generate a gradient for
 * @returns An object with the gradient and colors
 */
export function generateProfileGradient(username: string): {
  gradient: string;
  primaryColor: string;
  secondaryColor: string;
} {
  const primaryColor = generateUniqueColor(username, 75, 65);
  const secondaryColor = generateUniqueColor(username + 'salt', 65, 55);
  const gradient = `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`;

  return {
    gradient,
    primaryColor,
    secondaryColor
  };
}
