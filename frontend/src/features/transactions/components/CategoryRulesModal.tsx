import type React from 'react';
import type { UserCategory } from '../../../types/api';

export interface CategoryRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCategories: UserCategory[];
  onRulesChanged?: () => void;
}

export const CategoryRulesModal: React.FC<CategoryRulesModalProps> = ({ isOpen }) => {
  if (!isOpen) return null;
  return null;
};

export default CategoryRulesModal;

