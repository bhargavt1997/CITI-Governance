package com.citi.governance.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "stage_history")
public class StageHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "candidate_id")
    @JsonIgnoreProperties({"skillGaps", "allocations", "activities", "trainingNotes"})
    private Candidate candidate;

    @Enumerated(EnumType.STRING)
    private OnboardingStage stage;

    private LocalDateTime completedAt = LocalDateTime.now();
    private String completedBy;

    @Column(columnDefinition = "text")
    private String notes;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Candidate getCandidate() { return candidate; }
    public void setCandidate(Candidate candidate) { this.candidate = candidate; }
    public OnboardingStage getStage() { return stage; }
    public void setStage(OnboardingStage stage) { this.stage = stage; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    public String getCompletedBy() { return completedBy; }
    public void setCompletedBy(String completedBy) { this.completedBy = completedBy; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
