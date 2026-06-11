package com.citi.governance.web;

import com.citi.governance.model.Role;
import com.citi.governance.repo.AppUserRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final AppUserRepository users;

    public UserController(AppUserRepository users) {
        this.users = users;
    }

    /** Names of all managers — used as the reporting-manager choices when re-mapping a developer. */
    @GetMapping("/managers")
    public List<Map<String, Object>> managers() {
        return users.findAll().stream()
                .filter(u -> u.getRole() == Role.MANAGER)
                .map(u -> Map.<String, Object>of("id", u.getId(), "name", u.getName(), "email", u.getEmail()))
                .toList();
    }
}
