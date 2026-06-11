package com.citi.governance.auth;

import com.citi.governance.model.AppUser;
import com.citi.governance.model.AuthToken;
import com.citi.governance.model.Role;
import com.citi.governance.repo.AppUserRepository;
import com.citi.governance.repo.AuthTokenRepository;
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
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public AuthService(AppUserRepository users, AuthTokenRepository tokens) {
        this.users = users;
        this.tokens = tokens;
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

    public AppUser requireLead(HttpServletRequest request) {
        AppUser u = current(request);
        if (u.getRole() != Role.LEAD) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Lead role required");
        }
        return u;
    }

    /** Leads may act on anyone; developers only on their own candidate record. */
    public AppUser requireLeadOrSelf(HttpServletRequest request, Long candidateId) {
        AppUser u = current(request);
        if (u.getRole() == Role.LEAD) return u;
        if (u.getCandidateId() != null && u.getCandidateId().equals(candidateId)) return u;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only modify your own record");
    }
}
