package com.citi.governance.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "enrollments", uniqueConstraints = @UniqueConstraint(columnNames = {"training_id", "candidate_id"}))
public class Enrollment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "training_id")
    @JsonIgnore
    private Training training;

    @ManyToOne(optional = false)
    @JoinColumn(name = "candidate_id")
    @JsonIgnoreProperties({"skillGaps", "allocations", "activities", "trainingNotes"})
    private Candidate candidate;

    @Enumerated(EnumType.STRING)
    private EnrollmentStatus status = EnrollmentStatus.ENROLLED;

    private Integer progressPct = 0;

    @Column(columnDefinition = "text")
    private String notes;

    private LocalDateTime enrolledAt = LocalDateTime.now();

    public Long getTrainingId() {
        return training != null ? training.getId() : null;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Training getTraining() { return training; }
    public void setTraining(Training training) { this.training = training; }
    public Candidate getCandidate() { return candidate; }
    public void setCandidate(Candidate candidate) { this.candidate = candidate; }
    public EnrollmentStatus getStatus() { return status; }
    public void setStatus(EnrollmentStatus status) { this.status = status; }
    public Integer getProgressPct() { return progressPct; }
    public void setProgressPct(Integer progressPct) { this.progressPct = progressPct; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public LocalDateTime getEnrolledAt() { return enrolledAt; }
    public void setEnrolledAt(LocalDateTime enrolledAt) { this.enrolledAt = enrolledAt; }
}
