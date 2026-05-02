/**
 * Rounds a number to a specified number of decimal places.
 * Default is 2 decimal places for financial calculations.
 */
export const round = (value: number, decimals: number = 2): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};
