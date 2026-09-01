import { ValidationContext, ValidationFinding, ValidationRule } from '../types';

export class RuleEngine {
  private rules: ValidationRule[] = [];

  constructor(initialRules: ValidationRule[] = []) {
    this.rules = [...initialRules];
  }

  /**
   * Registers a new validation rule
   */
  public registerRule(rule: ValidationRule): void {
    const existingIndex = this.rules.findIndex(r => r.id === rule.id);
    if (existingIndex >= 0) {
      this.rules[existingIndex] = rule;
    } else {
      this.rules.push(rule);
    }
  }

  /**
   * Registers multiple rules
   */
  public registerRules(rules: ValidationRule[]): void {
    rules.forEach(rule => this.registerRule(rule));
  }

  /**
   * Returns list of all registered rules
   */
  public getRules(): ValidationRule[] {
    return [...this.rules];
  }

  /**
   * Toggles rule state
   */
  public toggleRule(ruleId: string, enabled: boolean): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Executes all active rules on the provided context
   */
  public run(context: ValidationContext): ValidationFinding[] {
    const findings: ValidationFinding[] = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      try {
        const results = rule.validate(context);
        if (Array.isArray(results)) {
          findings.push(...results);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        findings.push({
          id: `rule_error_${rule.id}`,
          severity: 'warning',
          code: 'RULE_RUNTIME_ERROR',
          category: 'SYSTEM',
          title: `Error al evaluar regla: ${rule.name}`,
          message: `Ocurrió un error inesperado al procesar la regla: ${errorMsg}`,
          suggestion: 'Revisar la configuración o definición técnica de la regla.',
          technicalDetails: err instanceof Error ? err.stack : undefined,
        });
      }
    }

    return findings;
  }
}
