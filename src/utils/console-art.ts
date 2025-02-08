import chalk from 'chalk';

// Logger with colors
export const log = {
  info: (msg: string) => console.log(chalk.cyan('ℹ') + ' ' + msg),
  success: (msg: string) => console.log(chalk.green('✔') + ' ' + msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠') + ' ' + msg),
  error: (msg: string) => console.log(chalk.red('✖') + ' ' + msg),
  highlight: (msg: string) => console.log(chalk.magenta(msg)),
};

// ASCII art banner with modern professional design
export const serverStartupArt = `
${chalk.cyan('╭───────────────────── ')}${chalk.bold('Professional Network Platform')}${chalk.cyan(' ─────────────────────╮')}
${chalk.cyan('│                                                                      │')}
${chalk.cyan('│                     ')}${chalk.bold.white('⭒  MY PROFILE  ⭒')}${chalk.cyan('                      │')}
${chalk.cyan('│                     ')}${chalk.dim('──────────────────')}${chalk.cyan('                      │')}
${chalk.cyan('│                                                                      │')}
${chalk.cyan('│        ')}${chalk.italic('Connect • Collaborate • Create Opportunities')}${chalk.cyan('         │')}
${chalk.cyan('│                                                                      │')}
${chalk.cyan('├──────────────────────────────────────────────────────────────────────┤')}
${chalk.cyan('│                                                                      │')}
${chalk.cyan('│  ')}${chalk.green('⬢')}${chalk.dim(' Professional networking reimagined')}${chalk.cyan('                            │')}
${chalk.cyan('│  ')}${chalk.yellow('⬢')}${chalk.dim(' Showcase your expertise')}${chalk.cyan('                                     │')}
${chalk.cyan('│  ')}${chalk.blue('⬢')}${chalk.dim(' Build meaningful connections')}${chalk.cyan('                                  │')}
${chalk.cyan('│                                                                      │')}
${chalk.cyan('├──────────────────────────────────────────────────────────────────────┤')}
${chalk.cyan('│                                                                      │')}
${chalk.cyan('│  ')}${chalk.bold('Development Team')}${chalk.cyan('                                                │')}
${chalk.cyan('│  ────────────────                                                   │')}
${chalk.cyan('│                                                                      │')}
${chalk.cyan('│  ')}${chalk.white('Marco Blaise')}${chalk.cyan('                                                    │')}
${chalk.cyan('│  ')}${chalk.dim('Lead Developer & System Architect')}${chalk.cyan('                              │')}
${chalk.cyan('│                                                                      │')}
${chalk.cyan('│  ')}${chalk.dim('[ Actively expanding - Join our innovative team ]')}${chalk.cyan('                │')}
${chalk.cyan('│                                                                      │')}
${chalk.cyan('╰──────────────────────────────────────────────────────────────────────╯')}`;

// Export colors for use in other files
export const colors = {
  reset: chalk.reset(''),
  bright: chalk.bold(''),
  dim: chalk.dim(''),
  black: chalk.black(''),
  red: chalk.red(''),
  green: chalk.green(''),
  yellow: chalk.yellow(''),
  blue: chalk.blue(''),
  magenta: chalk.magenta(''),
  cyan: chalk.cyan(''),
  white: chalk.white(''),
  bgBlack: chalk.bgBlack(''),
  bgRed: chalk.bgRed(''),
  bgGreen: chalk.bgGreen(''),
  bgYellow: chalk.bgYellow(''),
  bgBlue: chalk.bgBlue(''),
  bgMagenta: chalk.bgMagenta(''),
  bgCyan: chalk.bgCyan(''),
  bgWhite: chalk.bgWhite(''),
};
