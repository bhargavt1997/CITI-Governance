package com.citi.governance.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig {

    /**
     * Allowed browser origin patterns for the API. Defaults to "*" so the API works behind dev
     * tunnels (e.g. *.trycloudflare.com, *.devtunnels.ms) and local dev out of the box. Auth uses
     * bearer tokens (no cookies), so a wildcard origin is safe. Lock this down for production via
     * APP_CORS_ALLOWED_ORIGINS, e.g. APP_CORS_ALLOWED_ORIGINS=https://app.example.com
     */
    @Value("${app.cors.allowed-origins:*}")
    private String[] allowedOrigins;

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOriginPatterns(allowedOrigins)
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS");
            }
        };
    }
}
