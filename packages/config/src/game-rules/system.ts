export interface SystemRule {
  cropGrowthDurationMs: number;
  cropWitherDurationMs: number;
  defaultCropYield: number;
  stealCapPerVisit: number;
  helpCapPerVisit: number;
  protectionDurationMs: number;
}

export const systemRules: SystemRule = {
  cropGrowthDurationMs: 15 * 60 * 1000,
  cropWitherDurationMs: 30 * 60 * 1000,
  defaultCropYield: 3,
  stealCapPerVisit: 2,
  helpCapPerVisit: 3,
  protectionDurationMs: 10 * 60 * 1000,
};
