package com.citi.governance.config;

import com.citi.governance.auth.AuthService;
import com.citi.governance.model.*;
import com.citi.governance.repo.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Configuration
public class DataSeeder {

    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("yyyy-MM");

    @Bean
    CommandLineRunner seed(CandidateRepository candidates, StageHistoryRepository history,
                           TimesheetRepository timesheets, TrainingRepository trainings,
                           EnrollmentRepository enrollments, AppUserRepository users,
                           PodRepository pods, CitiLeaderRepository citiLeaders,
                           AuthService auth, JdbcTemplate jdbc) {
        return args -> {
            // The LEAD role was renamed to MANAGER - migrate any pre-existing rows before they are mapped.
            migrateLeadRole(jdbc);
            // Move legacy A/B/C/D bands onto the new band scheme (b4l..b8); b6h+ are manager-only.
            migrateBands(jdbc);
            if (candidates.count() == 0) {
                seedGovernanceData(candidates, history, timesheets, trainings, enrollments);
            }
            // Remove Suresh Iyer and Anita Desai entirely (candidates + logins + all child data).
            removeStaleAccounts(jdbc);
            // Accounts are ensured idempotently every boot so they survive reseeds and new entries can be added.
            ensureManagerAccounts(users, auth);
            ensureDeveloperAccounts(users, candidates, auth);
            // Managers fill their own PTS, so each manager needs a linked candidate record.
            ensureManagerProfiles(users, candidates);
            // Atul Raj's demo team (managers + developers) - idempotent.
            ensureDemoPeople(candidates, history, users, auth);
            // Jitendr Kumar's 7-person team - idempotent.
            ensureJitendrTeam(candidates, history, users, auth);
            // Demo org mappings (run after manager candidate records exist).
            applyDemoOrg(jdbc);
            // Seed the delivery projects (pods) with senior-management leads + CITI owners.
            ensurePods(pods);
            // Seed the CITI (client-side) leadership owners.
            ensureCitiLeaders(citiLeaders);
            // Derive each person's CITI leadership from their pod's CITI owner.
            syncCitiByPod(pods, jdbc);
            // Seed a few months of delivery metrics for onboarded people so the GT Metrics page isn't empty.
            seedMetrics(jdbc);
        };
    }

    /** Idempotently seed the last 6 months of delivery metrics for every onboarded person. */
    private void seedMetrics(JdbcTemplate jdbc) {
        java.util.List<java.util.Map<String, Object>> rows =
                jdbc.queryForList("SELECT id FROM candidates WHERE current_stage = 'ONBOARDED'");
        java.time.LocalDate now = java.time.LocalDate.now();
        for (java.util.Map<String, Object> r : rows) {
            long id = ((Number) r.get("id")).longValue();
            for (int off = 0; off < 6; off++) {
                String month = now.minusMonths(off).format(MONTH);
                int commits = 18 + (int) ((id * 13 + off * 5) % 55);
                int storiesAssigned = 6 + (int) ((id * 3 + off) % 7);
                int storiesCompleted = Math.max(0, storiesAssigned - (int) ((id + off) % 3));
                int pointsAssigned = storiesAssigned * 3 + (int) ((id + off) % 5);
                int pointsCompleted = Math.min(pointsAssigned, storiesCompleted * 3 + (int) (id % 4));
                jdbc.update(
                        "INSERT INTO metrics (candidate_id, month, github_commits, stories_assigned, "
                        + "stories_completed, story_points_assigned, story_points_completed, updated_at) "
                        + "VALUES (?,?,?,?,?,?,?, now()) ON CONFLICT (candidate_id, month) DO NOTHING",
                        id, month, commits, storiesAssigned, storiesCompleted, pointsAssigned, pointsCompleted);
            }
        }
        // Backfill: ensure no existing metrics rows have a NULL highlights (empty string is the safe default).
        jdbc.update("UPDATE metrics SET highlights = '' WHERE highlights IS NULL");
    }

    /**
     * Demo-specific org structure.
     * Leadership chain: Srini (B2, CEO) -> Shubhi (B4H) -> Jitendr (B5H) -> Bhargav's 7-person team.
     * Idempotent.
     */
    private void applyDemoOrg(JdbcTemplate jdbc) {
        jdbc.update("UPDATE candidates SET band = 'b5h' "
                + "WHERE email = 'jitendrkumar@deloitte.com' AND (band IS NULL OR band <> 'b5h')");
        // Shubhi Gupta is a B4H leader who manages Jitendr; Srini is the B2 CEO above her.
        jdbc.update("UPDATE candidates SET band = 'b4h' WHERE email = 'shubhigupta7@deloitte.com'");
        jdbc.update("UPDATE candidates SET band = 'b2' WHERE email = 'ssrinagakedar@deloitte.com'");
        jdbc.update("UPDATE candidates SET reporting_manager = 'Shubhi Gupta' WHERE email = 'jitendrkumar@deloitte.com'");
        jdbc.update("UPDATE candidates SET reporting_manager = 'Srini Nagakedar' WHERE email = 'shubhigupta7@deloitte.com'");
        // Former Suresh / Anita reportees — reassigned to Atul Raj now that those accounts are removed.
        jdbc.update("UPDATE candidates SET reporting_manager = 'Atul Raj' "
                + "WHERE reporting_manager IN ('Suresh Iyer','Anita Desai')");
        // Jitendr Kumar's direct reports: the real 7-person team.
        jdbc.update("UPDATE candidates SET reporting_manager = 'Jitendr Kumar' "
                + "WHERE email IN ('tsbhargav@deloitte.com','tbansari@deloitte.com','atawri@deloitte.com',"
                + "'siaman@deloitte.com','asharjil@deloitte.com','dvitthalgajakosh@deloitte.com','padwivedi@deloitte.com')");
        // Everyone on Jitendr's team belongs to the RUBY pod.
        jdbc.update("UPDATE candidates SET pod = 'RUBY' "
                + "WHERE email IN ('tsbhargav@deloitte.com','tbansari@deloitte.com','atawri@deloitte.com',"
                + "'siaman@deloitte.com','asharjil@deloitte.com','dvitthalgajakosh@deloitte.com','padwivedi@deloitte.com')");
        // Atul Raj is a B5H senior manager reporting to Shubhi (a second senior-management branch).
        jdbc.update("UPDATE candidates SET band = 'b5h' WHERE email = 'aturaj@deloitte.com'");
        jdbc.update("UPDATE candidates SET reporting_manager = 'Shubhi Gupta' WHERE email = 'aturaj@deloitte.com'");
        // Legacy ORION project was renamed to ETL - migrate any rows + drop the old pod (re-seeded as ETL).
        jdbc.update("UPDATE candidates SET pod = 'ETL' WHERE pod = 'ORION'");
        jdbc.update("DELETE FROM pods WHERE name = 'ORION'");
        // Everyone is tied to a project (RUBY / HY / MES) via pod. Idempotent: only fills non-project pods.
        jdbc.update("UPDATE candidates SET pod = CASE (id % 3) WHEN 0 THEN 'RUBY' WHEN 1 THEN 'HY' ELSE 'MES' END "
                + "WHERE pod IS NULL OR pod NOT IN ('RUBY','HY','MES','ETL')");
        // A pod lead sits in the pod they lead: RUBY=Jitendr, HY=Atul, MES=Shubhi.
        jdbc.update("UPDATE candidates SET pod = 'RUBY' WHERE email = 'jitendrkumar@deloitte.com'");
        jdbc.update("UPDATE candidates SET pod = 'HY' WHERE email = 'aturaj@deloitte.com'");
        jdbc.update("UPDATE candidates SET pod = 'MES' WHERE email = 'shubhigupta7@deloitte.com'");
        // ETL project members, made HIGH-risk for differentiation (2 offboarding + 1 KARAT-failed).
        jdbc.update("UPDATE candidates SET pod = 'ETL' WHERE email IN "
                + "('arjun.mehta@deloitte.com','priya.sharma@deloitte.com','sneha.reddy@deloitte.com','meera.pillai@deloitte.com')");
        jdbc.update("UPDATE candidates SET current_stage = 'OFFBOARDING', offboarding_reason = 'Rolling off project ORION' "
                + "WHERE email IN ('arjun.mehta@deloitte.com','priya.sharma@deloitte.com') AND offboarding_reason IS NULL");
        jdbc.update("UPDATE candidates SET current_stage = 'KARAT_FAILED' WHERE email = 'meera.pillai@deloitte.com'");
        // The CEO reports to no one.
        jdbc.update("UPDATE candidates SET reporting_manager = NULL WHERE email = 'ssrinagakedar@deloitte.com'");
        // Assign a CITI leadership owner (Gonzalo / Joshua) to everyone - split by id, fill only blanks.
        jdbc.update("UPDATE candidates SET citi_leadership = 'Gonzalo' WHERE citi_leadership IS NULL AND (id % 2) = 0");
        jdbc.update("UPDATE candidates SET citi_leadership = 'Joshua' WHERE citi_leadership IS NULL AND (id % 2) = 1");
        // Demo: one candidate sits in the KARAT Failed stage.
        jdbc.update("UPDATE candidates SET current_stage = 'KARAT_FAILED' "
                + "WHERE email = 'rohan.joshi@deloitte.com'");
        // Demo: one onboarded person is being offboarded (with a reason shown on hover).
        jdbc.update("UPDATE candidates SET current_stage = 'OFFBOARDING', "
                + "offboarding_reason = 'Project ramp-down - rolling off the Citi engagement' "
                + "WHERE email = 'rahul.verma@deloitte.com' AND current_stage = 'ONBOARDED' AND offboarding_reason IS NULL");
        // SOEID only exists once onboarding has started - clear it for anyone in an earlier stage.
        jdbc.update("UPDATE candidates SET soeid = NULL WHERE soeid IS NOT NULL AND current_stage IN "
                + "('NOMINATED','CARAT_INTERVIEW','KARAT_FAILED','CLIENT_INTERVIEW','FINAL_SELECTION')");
        // Bhargav's SOEID, and every onboarded person must have one - backfill any that are missing.
        jdbc.update("UPDATE candidates SET soeid = 'TB22987' WHERE email = 'tsbhargav@deloitte.com' AND (soeid IS NULL OR soeid = '')");
        jdbc.update("UPDATE candidates SET soeid = 'SO' || lpad(id::text, 5, '0') "
                + "WHERE current_stage = 'ONBOARDED' AND (soeid IS NULL OR soeid = '')");
    }

    private static final String DEFAULT_PASSWORD = "Citi@123";
    private static final String DEFAULT_MANAGER_BAND = com.citi.governance.model.Bands.DEFAULT_MANAGER;

    /** Manager accounts (name, email). All share the default password. */
    private static final String[][] MANAGERS = {
            {"Bhargav T", "tsbhargav@deloitte.com"},
            {"Jitendr Kumar", "jitendrkumar@deloitte.com"},
            {"Shubhi Gupta", "shubhigupta7@deloitte.com"},
            {"Srini Nagakedar", "ssrinagakedar@deloitte.com"},
            {"Atul Raj", "aturaj@deloitte.com"},
    };

    /**
     * "LEAD" → "MANAGER" for any data seeded before the rename. Idempotent.
     * Hibernate's ddl-auto=update never rewrites the enum CHECK constraint it generated for the old
     * values, so we drop the stale role check constraints first; Hibernate re-creates them (with the
     * current enum values) on the next boot if needed.
     */
    private void migrateLeadRole(JdbcTemplate jdbc) {
        jdbc.execute("ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check");
        jdbc.execute("ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_role_check");
        // Enum CHECK constraints don't get updated by ddl-auto=update; drop the stale stage checks so the
        // new KARAT_FAILED stage can be written (Hibernate re-creates them with current values on boot).
        jdbc.execute("ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_current_stage_check");
        jdbc.execute("ALTER TABLE stage_history DROP CONSTRAINT IF EXISTS stage_history_stage_check");
        // The old karat_failed flag was replaced by the KARAT_FAILED stage.
        jdbc.execute("ALTER TABLE candidates DROP COLUMN IF EXISTS karat_failed");
        jdbc.update("UPDATE app_users SET role = 'MANAGER' WHERE role = 'LEAD'");
        jdbc.update("UPDATE candidates SET role = 'MANAGER' WHERE role = 'LEAD'");
    }

    /** Permanently remove stale demo accounts (Suresh Iyer, Anita Desai) and all their data. Idempotent. */
    private void removeStaleAccounts(JdbcTemplate jdbc) {
        String[] emails = {"suresh.iyer@deloitte.com", "anita.desai@deloitte.com"};
        for (String email : emails) {
            jdbc.update("DELETE FROM enrollments WHERE candidate_id IN (SELECT id FROM candidates WHERE email = ?)", email);
            jdbc.update("DELETE FROM timesheets   WHERE candidate_id IN (SELECT id FROM candidates WHERE email = ?)", email);
            jdbc.update("DELETE FROM metrics       WHERE candidate_id IN (SELECT id FROM candidates WHERE email = ?)", email);
            jdbc.update("DELETE FROM stage_history WHERE candidate_id IN (SELECT id FROM candidates WHERE email = ?)", email);
            jdbc.update("UPDATE app_users SET candidate_id = NULL WHERE email = ?", email);
            jdbc.update("DELETE FROM candidates WHERE email = ?", email);
            jdbc.update("DELETE FROM app_users WHERE email = ?", email);
        }
    }

    /**
     * Map legacy A/B/C/D bands onto the new scheme (b4l..b8) and keep managers on a manager band.
     * Idempotent - once migrated, values are already b*, so the CASE leaves them untouched.
     */
    private void migrateBands(JdbcTemplate jdbc) {
        // Managers must hold a manager-eligible band (b6h, b5l, b5h, b4l, b4h, b2 for the CEO).
        jdbc.update("UPDATE candidates SET band = '" + DEFAULT_MANAGER_BAND
                + "' WHERE role = 'MANAGER' AND (band IS NULL OR band NOT IN ('b6h','b5l','b5h','b4l','b4h','b2'))");
        // Developers must hold a developer band (b8, b7, b6l). Map legacy A/B/C/D and manager bands across.
        jdbc.update("UPDATE candidates SET band = CASE "
                + "WHEN band IN ('b8','b7','b6l') THEN band "
                + "WHEN band IN ('A','b6h','b5h') THEN 'b7' "
                + "ELSE 'b6l' END WHERE role = 'DEVELOPER'");
    }

    /** Create any missing manager account (default password). Idempotent. */
    private void ensureManagerAccounts(AppUserRepository users, AuthService auth) {
        for (String[] m : MANAGERS) {
            if (users.findByEmailIgnoreCase(m[1]).isEmpty()) {
                AppUser u = new AppUser();
                u.setName(m[0]);
                u.setEmail(m[1]);
                u.setPasswordHash(auth.hash(DEFAULT_PASSWORD));
                u.setRole(Role.MANAGER);
                users.save(u);
            }
        }
    }

    /** Give every non-manager candidate a developer login under their own email (default password). Idempotent. */
    private void ensureDeveloperAccounts(AppUserRepository users, CandidateRepository candidates, AuthService auth) {
        for (Candidate c : candidates.findAll()) {
            if (c.getRole() == Role.MANAGER) continue;
            if (users.findByEmailIgnoreCase(c.getEmail()).isEmpty()) {
                AppUser u = new AppUser();
                u.setName(c.getName());
                u.setEmail(c.getEmail());
                u.setPasswordHash(auth.hash(DEFAULT_PASSWORD));
                u.setRole(Role.DEVELOPER);
                u.setCandidateId(c.getId());
                users.save(u);
            }
        }
    }

    /**
     * Give every manager account a candidate record (so they can fill their own PTS) and cross-link
     * reporting lines between managers, so each manager's own timesheet is approved by a peer.
     * Idempotent - safe to run on every boot.
     */
    private void ensureManagerProfiles(AppUserRepository users, CandidateRepository candidates) {
        List<AppUser> managers = users.findAll().stream()
                .filter(u -> u.getRole() == Role.MANAGER)
                .toList();

        int idx = 0;
        for (AppUser m : managers) {
            if (m.getCandidateId() != null) { idx++; continue; }
            Candidate c = candidates.findByEmail(m.getEmail()).orElseGet(() -> new Candidate());
            c.setName(m.getName());
            c.setEmail(m.getEmail());
            c.setRole(Role.MANAGER);
            c.setCurrentStage(OnboardingStage.ONBOARDED);
            if (c.getBand() == null) c.setBand(DEFAULT_MANAGER_BAND);
            if (c.getWave() == null) c.setWave("-");
            if (c.getPod() == null) c.setPod("Leadership");
            if (c.getLocation() == null) c.setLocation("Hyderabad");
            if (c.getEmployeeId() == null) c.setEmployeeId("MGR" + (1010 + idx));
            if (c.getJoinDate() == null) c.setJoinDate(LocalDate.now().minusMonths(10).withDayOfMonth(1));
            Candidate saved = candidates.save(c);
            m.setCandidateId(saved.getId());
            users.save(m);
            idx++;
        }

        // Cross-link reporting managers so each manager's PTS is approved by another manager.
        if (managers.size() >= 2) {
            for (int i = 0; i < managers.size(); i++) {
                AppUser m = managers.get(i);
                AppUser peer = managers.get((i + 1) % managers.size());
                candidates.findById(m.getCandidateId()).ifPresent(c -> {
                    if (c.getReportingManager() == null || c.getReportingManager().isBlank()) {
                        c.setReportingManager(peer.getName());
                        candidates.save(c);
                    }
                });
            }
        }
    }

    /** Idempotently seed Jitendr Kumar's 7-person team. Skips anyone already in the system. */
    private void ensureJitendrTeam(CandidateRepository candidates, StageHistoryRepository history,
                                   AppUserRepository users, AuthService auth) {
        // name, email, band, pod, citiLeadership
        // All report to Jitendr Kumar and are ONBOARDED.
        String[][] people = {
            {"Aman Singhania",             "siaman@deloitte.com",            "b6h", "RUBY", "Gonzalo"},
            {"Abdullah Sherjil",           "asharjil@deloitte.com",           "b6l", "RUBY", "Gonzalo"},
            {"Bansari Shukla",             "tbansari@deloitte.com",            "b6h", "RUBY", "Gonzalo"},
            {"Aditya Tawri",               "atawri@deloitte.com",              "b6h", "RUBY", "Joshua"},
            {"Dhananjay Vitthalgajakosh",  "dvitthalgajakosh@deloitte.com",    "b6h", "RUBY", "Joshua"},
            {"Paranjal Dwivedi",           "padwivedi@deloitte.com",           "b6l", "RUBY", "Joshua"},
        };
        for (String[] p : people) {
            if (candidates.findByEmail(p[1]).isPresent() || users.findByEmailIgnoreCase(p[1]).isPresent()) continue;
            Role role = com.citi.governance.model.Bands.isManagerBand(p[2]) ? Role.MANAGER : Role.DEVELOPER;
            Candidate c = new Candidate();
            c.setName(p[0]);
            c.setEmail(p[1]);
            c.setBand(p[2]);
            c.setReportingManager("Jitendr Kumar");
            c.setPod(p[3]);
            c.setCitiLeadership(p[4]);
            c.setRole(role);
            c.setCurrentStage(OnboardingStage.ONBOARDED);
            c.setLocation("Hyderabad");
            c.setWave("Wave 1");
            c.setJoinDate(LocalDate.now().minusMonths(3).withDayOfMonth(1));
            c.setSoeid("SO" + (Math.abs(p[1].hashCode()) % 90000 + 10000));
            Candidate saved = candidates.save(c);

            StageHistory h = new StageHistory();
            h.setCandidate(saved);
            h.setStage(OnboardingStage.ONBOARDED);
            h.setCompletedBy("Jitendr Kumar");
            h.setNotes("Demo seed");
            history.save(h);

            AppUser u = new AppUser();
            u.setName(p[0]);
            u.setEmail(p[1]);
            u.setPasswordHash(auth.hash(DEFAULT_PASSWORD));
            u.setRole(role);
            u.setCandidateId(saved.getId());
            users.save(u);
        }
    }

    /**
     * Idempotently seed a fixed set of demo people (Atul Raj's team). Each row creates a Candidate +
     * linked login if the email doesn't already exist. Band sets the role; project goes in pod.
     */
    /** Seed the three delivery projects with senior-management leads + CITI owners, keeping them current. Idempotent. */
    private void ensurePods(PodRepository pods) {
        // name, leadName, leadEmail, citiLeader
        String[][] seed = {
            {"RUBY", "Jitendr Kumar", "jitendrkumar@deloitte.com", "Gonzalo"},
            {"MES",  "Shubhi Gupta",  "shubhigupta7@deloitte.com", "Gonzalo"},
            {"HY",   "Atul Raj",      "aturaj@deloitte.com",       "Joshua"},
            {"ETL",  "Atul Raj",      "aturaj@deloitte.com",       "Joshua"},
        };
        for (String[] s : seed) {
            Pod p = pods.findByNameIgnoreCase(s[0]).orElseGet(Pod::new);
            p.setName(s[0]);
            p.setLeadName(s[1]);
            p.setLeadEmail(s[2]);
            p.setCitiLeader(s[3]);
            pods.save(p);
        }
    }

    /** A person's CITI leadership is derived from the CITI owner of their pod (keeps the two consistent). */
    private void syncCitiByPod(PodRepository pods, JdbcTemplate jdbc) {
        for (Pod p : pods.findAll()) {
            if (p.getCitiLeader() == null || p.getCitiLeader().isBlank()) continue;
            jdbc.update("UPDATE candidates SET citi_leadership = ? WHERE pod = ?", p.getCitiLeader(), p.getName());
        }
    }

    /** Seed the default CITI leadership owners. Idempotent. */
    private void ensureCitiLeaders(CitiLeaderRepository leaders) {
        for (String name : new String[]{"Gonzalo", "Joshua"}) {
            if (leaders.existsByNameIgnoreCase(name)) continue;
            CitiLeader l = new CitiLeader();
            l.setName(name);
            leaders.save(l);
        }
    }

    private void ensureDemoPeople(CandidateRepository candidates, StageHistoryRepository history,
                                  AppUserRepository users, AuthService auth) {
        // name, email, band, reportingManager, pod(project), citiLeadership, stage
        String[][] people = {
            {"Naveen Rao",  "naveen.rao@deloitte.com",  "b6h", "Atul Raj",   "RUBY", "Joshua",  "ONBOARDED"},
            {"Pooja Iyer",  "pooja.iyer@deloitte.com",  "b6l", "Naveen Rao", "RUBY", "Joshua",  "ONBOARDED"},
            {"Sameer Khan", "sameer.khan@deloitte.com", "b7",  "Naveen Rao", "RUBY", "Gonzalo", "CARAT_INTERVIEW"},
            {"Lata Menon",  "lata.menon@deloitte.com",  "b8",  "Atul Raj",   "RUBY", "Gonzalo", "NOMINATED"},
        };
        for (String[] p : people) {
            if (candidates.findByEmail(p[1]).isPresent() || users.findByEmailIgnoreCase(p[1]).isPresent()) continue;
            Role role = com.citi.governance.model.Bands.isManagerBand(p[2]) ? Role.MANAGER : Role.DEVELOPER;
            OnboardingStage stage = OnboardingStage.valueOf(p[6]);
            Candidate c = new Candidate();
            c.setName(p[0]);
            c.setEmail(p[1]);
            c.setBand(p[2]);
            c.setReportingManager(p[3]);
            c.setPod(p[4]);
            c.setCitiLeadership(p[5]);
            c.setRole(role);
            c.setCurrentStage(stage);
            c.setLocation("Hyderabad");
            if (stage == OnboardingStage.ONBOARDED) {
                c.setJoinDate(LocalDate.now().minusMonths(3).withDayOfMonth(1));
                c.setSoeid("SO" + (Math.abs(p[1].hashCode()) % 90000 + 10000));
            }
            Candidate saved = candidates.save(c);

            StageHistory h = new StageHistory();
            h.setCandidate(saved);
            h.setStage(stage);
            h.setCompletedBy("Atul Raj");
            h.setNotes("Demo seed");
            history.save(h);

            AppUser u = new AppUser();
            u.setName(p[0]);
            u.setEmail(p[1]);
            u.setPasswordHash(auth.hash(DEFAULT_PASSWORD));
            u.setRole(role);
            u.setCandidateId(saved.getId());
            users.save(u);
        }
    }

    private void seedGovernanceData(CandidateRepository candidates, StageHistoryRepository history,
                                    TimesheetRepository timesheets, TrainingRepository trainings,
                                    EnrollmentRepository enrollments) {
        {

            String[][] people = {
                // name, email, soeid, band, wave, pod, location, manager, stage, monthsAgoNominated
                {"Arjun Mehta",    "arjun.mehta@deloitte.com",    "AM93211", "b8",  "Wave 1", "Payments",   "Hyderabad", "Atul Raj",  "ONBOARDED",               "5"},
                {"Priya Sharma",   "priya.sharma@deloitte.com",   "PS84102", "b7",  "Wave 1", "Payments",   "Bengaluru", "Atul Raj",  "ONBOARDED",               "5"},
                {"Rahul Verma",    "rahul.verma@deloitte.com",    "RV77345", "b8",  "Wave 1", "Cards",      "Pune",      "Atul Raj",  "ONBOARDED",               "4"},
                {"Sneha Reddy",    "sneha.reddy@deloitte.com",    "SR66120", "b7",  "Wave 2", "Cards",      "Hyderabad", "Bhargav T", "VDI_SETUP_IN_PROGRESS",   "3"},
                {"Vikram Nair",    "vikram.nair@deloitte.com",    "VN55980", "b6l", "Wave 2", "Risk",       "Chennai",   "Atul Raj",  "CITI_CLEARANCE_RECEIVED", "3"},
                {"Divya Krishnan", "divya.krishnan@deloitte.com", "",        "b7",  "Wave 2", "Risk",       "Bengaluru", "Atul Raj",  "ONBOARDING_INITIATED",    "2"},
                {"Karthik Rao",    "karthik.rao@deloitte.com",    "",        "b6l", "Wave 3", "Payments",   "Hyderabad", "Atul Raj",  "FINAL_SELECTION",         "2"},
                {"Ananya Gupta",   "ananya.gupta@deloitte.com",   "",        "b6l", "Wave 3", "Cards",      "Mumbai",    "Atul Raj",  "CLIENT_INTERVIEW",        "1"},
                {"Rohan Joshi",    "rohan.joshi@deloitte.com",    "",        "b7",  "Wave 3", "Risk",       "Pune",      "Bhargav T",    "KARAT_FAILED",            "1"},
                {"Meera Pillai",   "meera.pillai@deloitte.com",   "",        "b6l", "Wave 3", "Payments",   "Chennai",   "Bhargav T",    "NOMINATED",               "0"},
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
                c.setAllocations(stage == OnboardingStage.ONBOARDED ? p[5] + " pod - sprint team" : "Not yet allocated");
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
                {"AWS Certified Developer - Associate", "AWS", "Cloud", "Core AWS services, serverless, CI/CD for the Citi cloud migration workstream."},
                {"Java 21 & Spring Boot 3 Mastery", "Udemy", "Technical", "Modern Java, Spring Boot 3, JPA, and REST API design aligned to Citi standards."},
                {"Citi Domain - Payments Fundamentals", "Internal", "Domain", "ISO 20022, payment rails, settlement and clearing concepts used in the Payments pod."},
                {"React 19 Advanced Patterns", "Frontend Masters", "Technical", "Hooks, suspense, server components and performance for the governance UI stack."},
                {"CCAF - Claude Certified Architect Foundations", "Anthropic", "Technical", "Foundations of architecting applications with Claude - prompt design, tool use, agents, RAG, evaluation and safe, production-grade LLM integration."},
            };
            Training[] savedTrainings = new Training[certs.length];
            for (int i = 0; i < certs.length; i++) {
                Training t = new Training();
                t.setTitle(certs[i][0]);
                t.setProvider(certs[i][1]);
                t.setCategory(certs[i][2]);
                t.setDescription(certs[i][3]);
                t.setTargetDate(LocalDate.now().plusMonths(2 + i));
                t.setCreatedBy("Jitendr Kumar");
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
                        : e[3] == 1 ? "On track - weekly study plan in progress."
                        : "Enrolled, yet to start.");
                enrollments.save(en);
            }
        };
    }
}
