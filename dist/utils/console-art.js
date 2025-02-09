"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.colors = exports.serverStartupArt = exports.log = void 0;
const chalk_1 = __importDefault(require("chalk"));
// Logger with colors
exports.log = {
    info: (msg) => console.log(chalk_1.default.cyan('ℹ') + ' ' + msg),
    success: (msg) => console.log(chalk_1.default.green('✔') + ' ' + msg),
    warn: (msg) => console.log(chalk_1.default.yellow('⚠') + ' ' + msg),
    error: (msg) => console.log(chalk_1.default.red('✖') + ' ' + msg),
    highlight: (msg) => console.log(chalk_1.default.magenta(msg)),
};
// ASCII art banner with modern professional design
exports.serverStartupArt = `
${chalk_1.default.cyan('╭───────────────────── ')}${chalk_1.default.bold('Professional Network Platform')}${chalk_1.default.cyan(' ─────────────────────╮')}
${chalk_1.default.cyan('│                                                                      │')}
${chalk_1.default.cyan('│                     ')}${chalk_1.default.bold.white('⭒  MY PROFILE  ⭒')}${chalk_1.default.cyan('                      │')}
${chalk_1.default.cyan('│                     ')}${chalk_1.default.dim('──────────────────')}${chalk_1.default.cyan('                      │')}
${chalk_1.default.cyan('│                                                                      │')}
${chalk_1.default.cyan('│        ')}${chalk_1.default.italic('Connect • Collaborate • Create Opportunities')}${chalk_1.default.cyan('         │')}
${chalk_1.default.cyan('│                                                                      │')}
${chalk_1.default.cyan('├──────────────────────────────────────────────────────────────────────┤')}
${chalk_1.default.cyan('│                                                                      │')}
${chalk_1.default.cyan('│  ')}${chalk_1.default.green('⬢')}${chalk_1.default.dim(' Professional networking reimagined')}${chalk_1.default.cyan('                            │')}
${chalk_1.default.cyan('│  ')}${chalk_1.default.yellow('⬢')}${chalk_1.default.dim(' Showcase your expertise')}${chalk_1.default.cyan('                                     │')}
${chalk_1.default.cyan('│  ')}${chalk_1.default.blue('⬢')}${chalk_1.default.dim(' Build meaningful connections')}${chalk_1.default.cyan('                                  │')}
${chalk_1.default.cyan('│                                                                      │')}
${chalk_1.default.cyan('├──────────────────────────────────────────────────────────────────────┤')}
${chalk_1.default.cyan('│                                                                      │')}
${chalk_1.default.cyan('│  ')}${chalk_1.default.bold('Development Team')}${chalk_1.default.cyan('                                                │')}
${chalk_1.default.cyan('│  ────────────────                                                   │')}
${chalk_1.default.cyan('│                                                                      │')}
${chalk_1.default.cyan('│  ')}${chalk_1.default.white('Marco Blaise')}${chalk_1.default.cyan('                                                    │')}
${chalk_1.default.cyan('│  ')}${chalk_1.default.dim('Lead software Eng. & System Architect')}${chalk_1.default.cyan('                              │')}
${chalk_1.default.cyan('│                                                                      │')}
${chalk_1.default.cyan('│                                                                      │')}
${chalk_1.default.cyan('╰──────────────────────────────────────────────────────────────────────╯')}`;
// Export colors for use in other files
exports.colors = {
    reset: chalk_1.default.reset(''),
    bright: chalk_1.default.bold(''),
    dim: chalk_1.default.dim(''),
    black: chalk_1.default.black(''),
    red: chalk_1.default.red(''),
    green: chalk_1.default.green(''),
    yellow: chalk_1.default.yellow(''),
    blue: chalk_1.default.blue(''),
    magenta: chalk_1.default.magenta(''),
    cyan: chalk_1.default.cyan(''),
    white: chalk_1.default.white(''),
    bgBlack: chalk_1.default.bgBlack(''),
    bgRed: chalk_1.default.bgRed(''),
    bgGreen: chalk_1.default.bgGreen(''),
    bgYellow: chalk_1.default.bgYellow(''),
    bgBlue: chalk_1.default.bgBlue(''),
    bgMagenta: chalk_1.default.bgMagenta(''),
    bgCyan: chalk_1.default.bgCyan(''),
    bgWhite: chalk_1.default.bgWhite(''),
};
