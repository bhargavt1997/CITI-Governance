package com.citi.governance.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * A delivery project ("pod"). Created by senior management; led by a senior manager. The project
 * name is what gets stored in a Candidate's `pod` field.
 */
@Entity
@Table(name = "pods")
public class Pod {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    /** The pod lead - a senior manager. */
    private String leadName;
    private String leadEmail;

    /** The CITI (client-side) leadership owner for this pod, e.g. Gonzalo or Joshua. */
    private String citiLeader;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getLeadName() { return leadName; }
    public void setLeadName(String leadName) { this.leadName = leadName; }
    public String getLeadEmail() { return leadEmail; }
    public void setLeadEmail(String leadEmail) { this.leadEmail = leadEmail; }
    public String getCitiLeader() { return citiLeader; }
    public void setCitiLeader(String citiLeader) { this.citiLeader = citiLeader; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
