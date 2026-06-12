package com.citi.governance.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Monthly delivery metrics for a person: GitHub commits (the "GT metric"), Jira stories and
 * story points (assigned vs completed), plus free-text work highlights. One row per person per month.
 */
@Entity
@Table(name = "metrics", uniqueConstraints = @UniqueConstraint(columnNames = {"candidate_id", "month"}))
public class Metric {

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

    /** GitHub commits in the month - the "GT metric". */
    private Integer githubCommits = 0;
    private Integer storiesAssigned = 0;
    private Integer storiesCompleted = 0;
    private Integer storyPointsAssigned = 0;
    private Integer storyPointsCompleted = 0;

    @Column(length = 2000)
    private String highlights;

    private LocalDateTime updatedAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Candidate getCandidate() { return candidate; }
    public void setCandidate(Candidate candidate) { this.candidate = candidate; }
    public String getMonth() { return month; }
    public void setMonth(String month) { this.month = month; }
    public Integer getGithubCommits() { return githubCommits; }
    public void setGithubCommits(Integer githubCommits) { this.githubCommits = githubCommits; }
    public Integer getStoriesAssigned() { return storiesAssigned; }
    public void setStoriesAssigned(Integer storiesAssigned) { this.storiesAssigned = storiesAssigned; }
    public Integer getStoriesCompleted() { return storiesCompleted; }
    public void setStoriesCompleted(Integer storiesCompleted) { this.storiesCompleted = storiesCompleted; }
    public Integer getStoryPointsAssigned() { return storyPointsAssigned; }
    public void setStoryPointsAssigned(Integer storyPointsAssigned) { this.storyPointsAssigned = storyPointsAssigned; }
    public Integer getStoryPointsCompleted() { return storyPointsCompleted; }
    public void setStoryPointsCompleted(Integer storyPointsCompleted) { this.storyPointsCompleted = storyPointsCompleted; }
    public String getHighlights() { return highlights; }
    public void setHighlights(String highlights) { this.highlights = highlights; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
