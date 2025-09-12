import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import BalancesOverview from "./BalancesOverview";
import { installFetchRoutes } from "../test/fetchRoutes";
import { ApiClient } from "../services/ApiClient";

describe("BalancesOverview (Phase 7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ApiClient.setTestMaxRetries(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    cleanup();
  });

  it("uses useBalancesOverview() and renders API-provided totals and banks", async () => {
    const mock = {
      asOf: "latest",
      overall: {
        cash: 18250.55,
        credit: -3250.1,
        loan: -15400,
        investments: 42000,
        positivesTotal: 60250.55,
        negativesTotal: -18650.1,
        net: 41600.45,
        ratio: 3.23,
      },
      banks: [
        { bankId: "ins_123", bankName: "Chase", cash: 12500, credit: -2500.1, loan: 0, investments: 0, positivesTotal: 12500, negativesTotal: -2500.1, net: 10000.9, ratio: 5.0 },
        { bankId: "ins_456", bankName: "Vanguard", cash: 5750.55, credit: 0, loan: -15400, investments: 42000, positivesTotal: 47750.55, negativesTotal: -15400, net: 32350.55, ratio: 3.1 },
      ],
      mixedCurrency: false,
    };
    installFetchRoutes({ "GET /api/analytics/balances/overview": mock });

    render(<BalancesOverview />);
    // Loading skeleton appears first
    expect(screen.getByTestId("balances-loading")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("overall-cash").textContent).toContain("$18,250.55");
    });
    expect(screen.getByTestId("overall-investments").textContent).toContain("$42,000.00");
    expect(screen.getByTestId("overall-credit").textContent).toContain("-$3,250.10");
    expect(screen.getByTestId("overall-loan").textContent).toContain("-$15,400.00");
    expect(screen.getByTestId("overall-net").textContent).toContain("$41,600.45");

    // Banks labels and ratios
    expect(screen.getAllByText("Chase")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Vanguard")[0]).toBeInTheDocument();
    expect(screen.getAllByTestId("bank-Chase-ratio")[0].textContent).toBe("5.00");
  });

  it("shows friendly error state and recovers on retry", async () => {
    let failure = true;
    const ok = {
      asOf: "latest",
      overall: { cash: 1, credit: -1, loan: -1, investments: 1, positivesTotal: 2, negativesTotal: -2, net: 0, ratio: null },
      banks: [],
      mixedCurrency: false,
    };
    installFetchRoutes({
      "GET /api/analytics/balances/overview": () => (failure ? new Response("boom", { status: 500 }) : ok),
    });

    render(<BalancesOverview />);
    await waitFor(() => {
      expect(screen.getByTestId("balances-error")).toBeInTheDocument();
    });

    // Retry
    failure = false;
    fireEvent.click(screen.getByText(/Retry/i));

    await waitFor(() => {
      expect(screen.queryByTestId("balances-error")).not.toBeInTheDocument();
    });
    // Ratio pill renders ∞ when ratio = null
    expect(screen.getAllByText(/A\/L:/)[0].textContent).toContain("∞");
  });

  it("does not depend on dashboard time range and rerenders gracefully", async () => {
    let calls = 0;
    installFetchRoutes({
      "GET /api/analytics/balances/overview": () => {
        calls += 1;
        return {
          asOf: "latest",
          overall: { cash: 1, credit: -1, loan: -1, investments: 1, positivesTotal: 2, negativesTotal: -2, net: 0, ratio: 1 },
          banks: [],
          mixedCurrency: false,
        };
      },
    });

    const { rerender } = render(<BalancesOverview />);
    await waitFor(() => expect(calls).toBe(1));

    // Simulate page date context change by re-rendering component
    rerender(<BalancesOverview />);
    // Should not refetch solely due to rerender
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toBe(1);
  });
});
