import generatedTokens from './generated/tokens';

export type SemanticTextRole =
  | 'primary'
  | 'body'
  | 'muted'
  | 'subtle'
  | 'label'
  | 'inverse'
  | 'accent'
  | 'danger'
  | 'success'
  | 'warning'
  | 'info';

const semanticTextLightColors = {
  primary: generatedTokens.color['text-primary'].$value.hex,
  body: generatedTokens.color['text-body'].$value.hex,
  muted: generatedTokens.color['text-muted'].$value.hex,
  subtle: generatedTokens.color['text-subtle'].$value.hex,
  label: generatedTokens.color['text-label'].$value.hex,
  inverse: generatedTokens.color['text-inverse'].$value.hex,
  accent: generatedTokens.color['text-accent'].$value.hex,
  danger: generatedTokens.color['text-danger'].$value.hex,
  success: generatedTokens.color['text-success'].$value.hex,
  warning: generatedTokens.color['text-warning'].$value.hex,
  info: generatedTokens.color['text-info'].$value.hex,
} as const satisfies Record<SemanticTextRole, string>;

const semanticTextDarkColors = {
  primary: generatedTokens.color['text-primary-dark'].$value.hex,
  body: generatedTokens.color['text-body-dark'].$value.hex,
  muted: generatedTokens.color['text-muted-dark'].$value.hex,
  subtle: generatedTokens.color['text-subtle-dark'].$value.hex,
  label: generatedTokens.color['text-label-dark'].$value.hex,
  inverse: generatedTokens.color['text-inverse-dark'].$value.hex,
  accent: generatedTokens.color['text-accent-dark'].$value.hex,
  danger: generatedTokens.color['text-danger-dark'].$value.hex,
  success: generatedTokens.color['text-success-dark'].$value.hex,
  warning: generatedTokens.color['text-warning-dark'].$value.hex,
  info: generatedTokens.color['text-info-dark'].$value.hex,
} as const satisfies Record<SemanticTextRole, string>;

function textRole(light: string, dark: string): string {
  return `text-[${light}] dark:text-[${dark}]`;
}

export const semanticTextRecipes = {
  primary: textRole(semanticTextLightColors.primary, semanticTextDarkColors.primary),
  body: textRole(semanticTextLightColors.body, semanticTextDarkColors.body),
  muted: textRole(semanticTextLightColors.muted, semanticTextDarkColors.muted),
  subtle: textRole(semanticTextLightColors.subtle, semanticTextDarkColors.subtle),
  label: textRole(semanticTextLightColors.label, semanticTextDarkColors.label),
  inverse: textRole(semanticTextLightColors.inverse, semanticTextDarkColors.inverse),
  accent: textRole(semanticTextLightColors.accent, semanticTextDarkColors.accent),
  danger: textRole(semanticTextLightColors.danger, semanticTextDarkColors.danger),
  success: textRole(semanticTextLightColors.success, semanticTextDarkColors.success),
  warning: textRole(semanticTextLightColors.warning, semanticTextDarkColors.warning),
  info: textRole(semanticTextLightColors.info, semanticTextDarkColors.info),
} as const satisfies Record<SemanticTextRole, string>;
