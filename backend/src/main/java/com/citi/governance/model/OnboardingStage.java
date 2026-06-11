package com.citi.governance.model;

public enum OnboardingStage {
    NOMINATED("Nominated"),
    CARAT_INTERVIEW("KARAT Scheduled"),
    KARAT_FAILED("KARAT Failed"),
    CLIENT_INTERVIEW("Client Interview"),
    FINAL_SELECTION("Final Selection"),
    ONBOARDING_INITIATED("Onboarding Initiated"),
    CITI_CLEARANCE_RECEIVED("Citi Clearance Received"),
    VDI_SETUP_IN_PROGRESS("VDI Setup In Progress"),
    ONBOARDED("Onboarded");

    private final String label;

    OnboardingStage(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    public OnboardingStage next() {
        int idx = ordinal();
        OnboardingStage[] all = values();
        return idx < all.length - 1 ? all[idx + 1] : this;
    }
}
