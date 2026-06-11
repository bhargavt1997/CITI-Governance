package com.citi.governance.web;

import com.citi.governance.auth.AuthService;
import com.citi.governance.model.AppUser;
import com.citi.governance.model.AuthToken;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "");
        String password = body.getOrDefault("password", "");
        AppUser user = auth.authenticate(email, password)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));
        AuthToken token = auth.issueToken(user);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("token", token.getToken());
        out.put("user", user);
        return out;
    }

    @GetMapping("/me")
    public AppUser me(HttpServletRequest request) {
        return auth.current(request);
    }

    @PostMapping("/logout")
    public Map<String, String> logout(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            auth.revoke(header.substring(7));
        }
        return Map.of("message", "Logged out");
    }
}
