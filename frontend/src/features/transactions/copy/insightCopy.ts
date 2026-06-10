import type { InsightState } from '@/types/api';

export interface InsightStateCopy {
  card1: { title: string; question: string };
  card2: { title: string; question: string };
  card3: { title: string; question: string };
}

export const INSIGHT_COPY: Record<InsightState, InsightStateCopy> = {
  a: {
    card1: {
      title: 'Volume',
      question: 'How much, across how many transactions?',
    },
    card2: {
      title: 'Typical',
      question: 'What does a typical purchase look like?',
    },
    card3: {
      title: 'Breakdown',
      question: 'How many expenses are fixed or extraneous?',
    },
  },
  b: {
    card1: {
      title: 'Category Total',
      question: "What's my total here, and how big a slice is it?",
    },
    card2: {
      title: 'Typical',
      question: 'What does a typical purchase here cost?',
    },
    card3: {
      title: 'vs All Categories',
      question: 'Is a typical purchase here bigger or smaller than your overall median?',
    },
  },
  c: {
    card1: {
      title: 'Lifetime Spend',
      question: 'How much have I spent here in total?',
    },
    card2: {
      title: 'Usual Order',
      question: "What's my go-to order here?",
    },
    card3: {
      title: 'vs Category',
      question: 'Is this merchant pricier than its category?',
    },
  },
  d: {
    card1: {
      title: 'Account Total',
      question: 'How much runs through this account, and what share is it?',
    },
    card2: {
      title: 'Typical',
      question: 'What does a typical charge here look like?',
    },
    card3: {
      title: 'vs All Accounts',
      question: 'Is a typical charge here bigger or smaller than your overall median?',
    },
  },
  e: {
    card1: {
      title: 'Subtotal',
      question: 'How much of this category goes on this card?',
    },
    card2: {
      title: 'Typical',
      question: 'What does a typical purchase here cost?',
    },
    card3: {
      title: 'Share of Wallet',
      question: 'What share of this category lands on this card?',
    },
  },
  f: {
    card1: {
      title: 'Card Loyalty',
      question: 'How much have I spent here on this card?',
    },
    card2: {
      title: 'Typical',
      question: "What's my typical receipt here on this card?",
    },
    card3: {
      title: 'Swipe Preference',
      question: 'How often do I use this card here vs others?',
    },
  },
  g: {
    card1: {
      title: 'Merchant Total',
      question: 'How much here, and what slice of the category?',
    },
    card2: {
      title: 'Typical',
      question: 'What does a typical purchase here cost?',
    },
    card3: {
      title: 'vs Category',
      question: 'Is this merchant pricier than the category average?',
    },
  },
  triple: {
    card1: {
      title: 'Subset Total',
      question: "What's the total of this exact subset?",
    },
    card2: {
      title: 'Usual Amount',
      question: 'What do I spend most often on this?',
    },
    card3: {
      title: 'Last Visit',
      question: 'How long since I last did this?',
    },
  },
};
