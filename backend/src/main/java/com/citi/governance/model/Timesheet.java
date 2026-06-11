package com.citi.governance.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "timesheets", uniqueConstraints = @UniqueConstraint(columnNames = {"candidate_id", "month"}))
public class Timesheet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "candidate_id")
    @JsonIgnoreProperties({"skillGaps", "allocations", "activities", "trainingNotes"})
    private Candidate candidate;

    /** Format: yyyy-MM, e.g. 2026-06 */
    @Column(nullable = false)
    private String month;

    private Double week1 = 0.0;
    private Double week2 = 0.0;
    private Double week3 = 0.0;
    private Double week4 = 0.0;
    private Double week5 = 0.0;

    private Double total = 0.0;

    /** Approval workflow: developer saves → SUBMITTED; reporting manager approves/rejects. */
    @Enumerated(EnumType.STRING)
    private TimesheetStatus status = TimesheetStatus.SUBMITTED;

    private String approvedBy;
    private LocalDateTime approvedAt;

    private LocalDateTime updatedAt = LocalDateTime.now();

    public void recalcTotal() {
        total = nz(week1) + nz(week2) + nz(week3) + nz(week4) + nz(week5);
    }

    private static double nz(Double d) {
        return d == null ? 0.0 : d;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Candidate getCandidate() { return candidate; }
    public void setCandidate(Candidate candidate) { this.candidate = candidate; }
    public String getMonth() { return month; }
    public void setMonth(String month) { this.month = month; }
    public Double getWeek1() { return week1; }
    public void setWeek1(Double week1) { this.week1 = week1; }
    public Double getWeek2() { return week2; }
    public void setWeek2(Double week2) { this.week2 = week2; }
    public Double getWeek3() { return week3; }
    public void setWeek3(Double week3) { this.week3 = week3; }
    public Double getWeek4() { return week4; }
    public void setWeek4(Double week4) { this.week4 = week4; }
    public Double getWeek5() { return week5; }
    public void setWeek5(Double week5) { this.week5 = week5; }
    public Double getTotal() { return total; }
    public void setTotal(Double total) { this.total = total; }
    public TimesheetStatus getStatus() { return status; }
    public void setStatus(TimesheetStatus status) { this.status = status; }
    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }
    public LocalDateTime getApprovedAt() { return approvedAt; }
    public void setApprovedAt(LocalDateTime approvedAt) { this.approvedAt = approvedAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
