package com.citi.governance.config;

import com.citi.governance.auth.AuthService;
import com.citi.governance.model.*;
import com.citi.governance.repo.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Configuration
public class DataSeeder {

    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("yyyy-MM");

    @Bean
    CommandLineRunner seed(CandidateRepository candidates, StageHistoryRepository history,
                           TimesheetRepository timesheets, TrainingRepository trainings,
                           EnrollmentRepository enrollments, AppUserRepository users,
                           AuthService auth) {
        return args -> {
            if (candidates.count() == 0) {
                seedGovernanceData(candidates, history, timesheets, trainings, enrollments);
            }
            if (users.count() == 0) {
                seedUsers(users, candidates, auth);
            }
        };
    }

    /**
     * Default password for all seeded accounts is "Citi@123".
     * Leads: suresh.iyer@deloitte.com, anita.desai@deloitte.com.
     * Every candidate gets a developer login under their own email.
     */
    private void seedUsers(AppUserRepository users, CandidateRepository candidates, AuthService auth) {
        String defaultHash = auth.hash("Citi@123");

        for (String[] lead : new String[][]{
                {"Suresh Iyer", "suresh.iyer@deloitte.com"},
                {"Anita Desai", "anita.desai@deloitte.com"}}) {
            AppUser u = new AppUser();
            u.setName(lead[0]);
            u.setEmail(lead[1]);
            u.setPasswordHash(defaultHash);
            u.setRole(Role.LEAD);
            users.save(u);
        }

        for (Candidate c : candidates.findAll()) {
            AppUser u = new AppUser();
            u.setName(c.getName());
            u.setEmail(c.getEmail());
            u.setPasswordHash(defaultHash);
            u.setRole(Role.DEVELOPER);
            u.setCandidateId(c.getId());
            users.save(u);
        }
    }

    private void seedGovernanceData(CandidateRepository candidates, StageHistoryRepository history,
                                    TimesheetRepository timesheets, TrainingRepository trainings,
                                    EnrollmentRepository enrollments) {
        {

            String[][] people = {
                // name, email, soeid, band, wave, pod, location, manager, stage, monthsAgoNominated
                {"Arjun Mehta",    "arjun.mehta@deloitte.com",    "AM93211", "C", "Wave 1", "Payments",   "Hyderabad", "Suresh Iyer",  "ONBOARDED",               "5"},
                {"Priya Sharma",   "priya.sharma@deloitte.com",   "PS84102", "C", "Wave 1", "Payments",   "Bengaluru", "Suresh Iyer",  "ONBOARDED",               "5"},
                {"Rahul Verma",    "rahul.verma@deloitte.com",    "RV77345", "B", "Wave 1", "Cards",      "Pune",      "Anita Desai",  "ONBOARDED",               "4"},
                {"Sneha Reddy",    "sneha.reddy@deloitte.com",    "SR66120", "C", "Wave 2", "Cards",      "Hyderabad", "Anita Desai",  "VDI_SETUP_IN_PROGRESS",   "3"},
                {"Vikram Nair",    "vikram.nair@deloitte.com",    "VN55980", "B", "Wave 2", "Risk",       "Chennai",   "Suresh Iyer",  "CITI_CLEARANCE_RECEIVED", "3"},
                {"Divya Krishnan", "divya.krishnan@deloitte.com", "DK44871", "C", "Wave 2", "Risk",       "Bengaluru", "Anita Desai",  "ONBOARDING_INITIATED",    "2"},
                {"Karthik Rao",    "karthik.rao@deloitte.com",    "",        "C", "Wave 3", "Payments",   "Hyderabad", "Suresh Iyer",  "FINAL_SELECTION",         "2"},
                {"Ananya Gupta",   "ananya.gupta@deloitte.com",   "",        "D", "Wave 3", "Cards",      "Mumbai",    "Anita Desai",  "CLIENT_INTERVIEW",        "1"},
                {"Rohan Joshi",    "rohan.joshi@deloitte.com",    "",        "C", "Wave 3", "Risk",       "Pune",      "Suresh Iyer",  "CARAT_INTERVIEW",         "1"},
                {"Meera Pillai",   "meera.pillai@deloitte.com",   "",        "D", "Wave 3", "Payments",   "Chennai",   "Anita Desai",  "NOMINATED",               "0"},
            };

            int[][] skills = {
                {85, 70, 60, 75, 80}, {78, 82, 55, 70, 65}, {90, 60, 70, 80, 75},
                {72, 68, 50, 60, 40}, {80, 75, 65, 72, 55}, {65, 70, 45, 55, 30},
                {70, 60, 40, 50, 25}, {60, 55, 35, 45, 20}, {68, 50, 30, 40, 15},
                {55, 45, 25, 35, 10},
            };

            LocalDateTime now = LocalDateTime.now();
            Candidate[] saved = new Candidate[people.length];

            for (int i = 0; i < people.length; i++) {
                String[] p = people[i];
                Candidate c = new Candidate();
                c.setName(p[0]);
                c.setEmail(p[1]);
                c.setSoeid(p[2].isBlank() ? null : p[2]);
                c.setBand(p[3]);
                c.setWave(p[4]);
                c.setPod(p[5]);
                c.setLocation(p[6]);
                c.setReportingManager(p[7]);
                c.setRole(Role.DEVELOPER);
                OnboardingStage stage = OnboardingStage.valueOf(p[8]);
                c.setCurrentStage(stage);
                int monthsAgo = Integer.parseInt(p[9]);
                if (stage == OnboardingStage.ONBOARDED) {
                    c.setJoinDate(LocalDate.now().minusMonths(monthsAgo - 1L).withDayOfMonth(1));
                    c.setEmployeeId("EMP" + (10500 + i));
                }
                c.setSkillTechnical(skills[i][0]);
                c.setSkillFunctional(skills[i][1]);
                c.setSkillLeadership(skills[i][2]);
                c.setSkillDomain(skills[i][3]);
                c.setSkillCertifications(skills[i][4]);
                c.setSkillGaps(stage == OnboardingStage.ONBOARDED
                        ? "Advanced Kafka, Citi internal frameworks"
                        : "Citi domain knowledge, client communication");
                c.setAllocations(stage == OnboardingStage.ONBOARDED ? p[5] + " pod — sprint team" : "Not yet allocated");
                c.setActivities(stage == OnboardingStage.ONBOARDED ? "Sprint delivery, daily standups" : "Onboarding prep");
                c.setCreatedAt(now.minusMonths(monthsAgo));
                saved[i] = candidates.save(c);

                // Stage history: one entry per completed stage, spread over the weeks since nomination
                int reached = stage.ordinal();
                for (int s = 0; s <= reached; s++) {
                    StageHistory h = new StageHistory();
                    h.setCandidate(saved[i]);
                    h.setStage(OnboardingStage.values()[s]);
                    h.setCompletedAt(now.minusMonths(monthsAgo).plusWeeks((long) s * 2));
                    h.setCompletedBy(p[7]);
                    history.save(h);
                }
            }

            // Timesheets for onboarded candidates: current month + two previous
            for (int m = 2; m >= 0; m--) {
                String month = LocalDate.now().minusMonths(m).format(MONTH);
                for (int i = 0; i < 3; i++) { // first three are onboarded
                    Timesheet t = new Timesheet();
                    t.setCandidate(saved[i]);
                    t.setMonth(month);
                    t.setWeek1(40.0);
                    t.setWeek2(40.0);
                    t.setWeek3(m == 0 ? 0.0 : 38.0 + i);
                    t.setWeek4(m == 0 ? 0.0 : 40.0);
                    t.setWeek5(0.0);
                    t.recalcTotal();
                    timesheets.save(t);
                }
            }

            // Trainings / certifications
            String[][] certs = {
                {"AWS Certified Developer – Associate", "AWS", "Cloud", "Core AWS services, serverless, CI/CD for the Citi cloud migration workstream."},
                {"Java 21 & Spring Boot 3 Mastery", "Udemy", "Technical", "Modern Java, Spring Boot 3, JPA, and REST API design aligned to Citi standards."},
                {"Citi Domain — Payments Fundamentals", "Internal", "Domain", "ISO 20022, payment rails, settlement and clearing concepts used in the Payments pod."},
                {"React 19 Advanced Patterns", "Frontend Masters", "Technical", "Hooks, suspense, server components and performance for the governance UI stack."},
            };
            Training[] savedTrainings = new Training[certs.length];
            for (int i = 0; i < certs.length; i++) {
                Training t = new Training();
                t.setTitle(certs[i][0]);
                t.setProvider(certs[i][1]);
                t.setCategory(certs[i][2]);
                t.setDescription(certs[i][3]);
                t.setTargetDate(LocalDate.now().plusMonths(2 + i));
                t.setCreatedBy("Suresh Iyer");
                savedTrainings[i] = trainings.save(t);
            }

            // Enrollments with varied progress
            int[][] enrollPlan = {
                // candidateIdx, trainingIdx, progress, statusOrdinal (0 ENROLLED, 1 IN_PROGRESS, 2 COMPLETED)
                {0, 0, 100, 2}, {0, 2, 60, 1}, {1, 0, 45, 1}, {1, 3, 20, 1},
                {2, 1, 100, 2}, {2, 0, 30, 1}, {3, 1, 10, 1}, {4, 2, 0, 0}, {5, 3, 0, 0},
            };
            for (int[] e : enrollPlan) {
                Enrollment en = new Enrollment();
                en.setTraining(savedTrainings[e[1]]);
                en.setCandidate(saved[e[0]]);
                en.setProgressPct(e[2]);
                en.setStatus(EnrollmentStatus.values()[e[3]]);
                en.setNotes(e[3] == 2 ? "Certification completed and verified."
                        : e[3] == 1 ? "On track — weekly study plan in progress."
                        : "Enrolled, yet to start.");
                enrollments.save(en);
            }
        };
    }
}
