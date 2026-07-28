import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { BillingService } from '@/services/BillingService';
import { BillingWorkflowController, type BillingWorkflowGateway } from './billingWorkflow';
import { openOverlayCheckout } from './paddleClient';
import { BILLING_STATUS_QUERY_KEY } from './useBillingStatus';

export type BillingWorkflowServices = Omit<BillingWorkflowGateway, 'cacheStatus'>;

const defaultServices: BillingWorkflowServices = {
  getStatus: BillingService.getStatus,
  createCheckout: BillingService.createCheckout,
  startTrial: BillingService.startTrial,
  createPaymentMethodTransaction: BillingService.createPaymentMethodTransaction,
  openOverlayCheckout,
};

export interface UseBillingWorkflowOptions {
  services?: BillingWorkflowServices;
}

export function useBillingWorkflow(options: UseBillingWorkflowOptions = {}) {
  const queryClient = useQueryClient();
  const services = useRef(options.services ?? defaultServices);
  const controller = useRef<BillingWorkflowController | null>(null);
  if (!controller.current) {
    controller.current = new BillingWorkflowController({
      ...services.current,
      cacheStatus: (status) => {
        queryClient.setQueryData(BILLING_STATUS_QUERY_KEY, status);
      },
    });
  }
  const workflow = controller.current;
  const state = useSyncExternalStore(workflow.subscribe, workflow.getState, workflow.getState);

  useEffect(
    () => () => {
      workflow.dispose();
    },
    [workflow]
  );

  return {
    ...state,
    startPremiumCheckout: workflow.startPremiumCheckout,
    startCardlessTrial: workflow.startCardlessTrial,
    startTrialPaymentMethod: workflow.startTrialPaymentMethod,
    startPastDueRecovery: workflow.startPastDueRecovery,
    retry: workflow.retry,
    cancel: workflow.cancel,
  };
}
