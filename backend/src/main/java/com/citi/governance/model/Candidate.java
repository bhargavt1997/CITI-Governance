package com.citi.governance.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "candidates")
public class Candidate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(unique = true)
    private String soeid;

    private String employeeId;
    private String band;
    private String wave;
    private String pod;

    @Enumerated(EnumType.STRING)
    private Role role = Role.DEVELOPER;

    private String location;
    private LocalDate joinDate;
    private String reportingManager;

    @Enumerated(EnumType.STRING)
    private OnboardingStage currentStage = OnboardingStage.NOMINATED;

    // Skill radar (0-100 per axis)
    private Integer skillTechnical = 0;
    private Integer skillFunctional = 0;
    private Integer skillLeadership = 0;
    private Integer skillDomain = 0;
    private Integer skillCertifications = 0;

    @Column(columnDefinition = "text")
    private String skillGaps;

    @Column(columnDefinition = "text")
    private String allocations;

    @Column(columnDefinition = "text")
    private String activities;

    @Column(columnDefinition = "text")
    private String trainingNotes;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getSoeid() { return soeid; }
    public void setSoeid(String soeid) { this.soeid = soeid; }
    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
    public String getBand() { return band; }
    public void setBand(String band) { this.band = band; }
    public String getWave() { return wave; }
    public void setWave(String wave) { this.wave = wave; }
    public String getPod() { return pod; }
    public void setPod(String pod) { this.pod = pod; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public LocalDate getJoinDate() { return joinDate; }
    public void setJoinDate(LocalDate joinDate) { this.joinDate = joinDate; }
    public String getReportingManager() { return reportingManager; }
    public void setReportingManager(String reportingManager) { this.reportingManager = reportingManager; }
    public OnboardingStage getCurrentStage() { return currentStage; }
    public void setCurrentStage(OnboardingStage currentStage) { this.currentStage = currentStage; }
    public Integer getSkillTechnical() { return skillTechnical; }
    public void setSkillTechnical(Integer skillTechnical) { this.skillTechnical = skillTechnical; }
    public Integer getSkillFunctional() { return skillFunctional; }
    public void setSkillFunctional(Integer skillFunctional) { this.skillFunctional = skillFunctional; }
    public Integer getSkillLeadership() { return skillLeadership; }
    public void setSkillLeadership(Integer skillLeadership) { this.skillLeadership = skillLeadership; }
    public Integer getSkillDomain() { return skillDomain; }
    public void setSkillDomain(Integer skillDomain) { this.skillDomain = skillDomain; }
    public Integer getSkillCertifications() { return skillCertifications; }
    public void setSkillCertifications(Integer skillCertifications) { this.skillCertifications = skillCertifications; }
    public String getSkillGaps() { return skillGaps; }
    public void setSkillGaps(String skillGaps) { this.skillGaps = skillGaps; }
    public String getAllocations() { return allocations; }
    public void setAllocations(String allocations) { this.allocations = allocations; }
    public String getActivities() { return activities; }
    public void setActivities(String activities) { this.activities = activities; }
    public String getTrainingNotes() { return trainingNotes; }
    public void setTrainingNotes(String trainingNotes) { this.trainingNotes = trainingNotes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
