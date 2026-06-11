package com.citi.governance.auth;

import com.citi.governance.model.AppUser;
import com.citi.governance.model.AuthToken;
import com.citi.governance.model.Bands;
import com.citi.governance.model.Role;
import com.citi.governance.repo.AppUserRepository;
import com.citi.governance.repo.AuthTokenRepository;
import com.citi.governance.repo.CandidateRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    public static final String USER_ATTR = "authUser";
    private static final int TOKEN_DAYS = 7;

    private final AppUserRepository users;
    private final AuthTokenRepository tokens;
    private final CandidateRepository candidates;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public AuthService(AppUserRepository users, AuthTokenRepository tokens, CandidateRepository candidates) {
        this.users = users;
        this.tokens = tokens;
        this.candidates = candidates;
    }

    public String hash(String raw) {
        return encoder.encode(raw);
    }

    public Optional<AppUser> authenticate(String email, String password) {
        return users.findByEmailIgnoreCase(email)
                .filter(u -> encoder.matches(password, u.getPasswordHash()));
    }

    public AuthToken issueToken(AppUser user) {
        AuthToken t = new AuthToken();
        t.setToken(UUID.randomUUID().toString());
        t.setUserId(user.getId());
        t.setExpiresAt(LocalDateTime.now().plusDays(TOKEN_DAYS));
        return tokens.save(t);
    }

    public Optional<AppUser> resolve(String bearerToken) {
        return tokens.findById(bearerToken)
                .filter(t -> t.getExpiresAt() == null || t.getExpiresAt().isAfter(LocalDateTime.now()))
                .flatMap(t -> users.findById(t.getUserId()));
    }

    public void revoke(String bearerToken) {
        tokens.deleteById(bearerToken);
    }

    /** The authenticated user attached to this request by AuthFilter. */
    public AppUser current(HttpServletRequest request) {
        AppUser u = (AppUser) request.getAttribute(USER_ATTR);
        if (u == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        return u;
    }

    public AppUser requireManager(HttpServletRequest request) {
        AppUser u = current(request);
        if (u.getRole() != Role.MANAGER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Manager role required");
        }
        return u;
    }

    /** Senior managers only (a manager whose band is b5l/b5h/b4l/b4h). */
    public AppUser requireSeniorManager(HttpServletRequest request) {
        AppUser u = requireManager(request);
        boolean senior = u.getCandidateId() != null
                && candidates.findById(u.getCandidateId())
                        .map(c -> Bands.isSeniorBand(c.getBand()))
                        .orElse(false);
        if (!senior) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Senior manager role required");
        }
        return u;
    }

    /** Only the owner of a candidate record - used for actions nobody else may perform on your behalf (e.g. filling your own PTS). */
    public AppUser requireSelf(HttpServletRequest request, Long candidateId) {
        AppUser u = current(request);
        if (u.getCandidateId() != null && u.getCandidateId().equals(candidateId)) return u;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only fill your own timesheet");
    }

    /** Managers may act on anyone; developers only on their own candidate record. */
    public AppUser requireManagerOrSelf(HttpServletRequest request, Long candidateId) {
        AppUser u = current(request);
        if (u.getRole() == Role.MANAGER) return u;
        if (u.getCandidateId() != null && u.getCandidateId().equals(candidateId)) return u;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only modify your own record");
    }
}
