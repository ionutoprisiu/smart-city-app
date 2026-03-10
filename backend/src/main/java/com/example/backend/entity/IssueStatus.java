package com.example.backend.entity;

public enum IssueStatus {
    DESCHISA("Open"),
    IN_REZOLVARE("In Progress"),
    REZOLVATA("Resolved");

    private final String displayName;

    IssueStatus(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
