package com.citi.governance.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String BEARER = "bearerAuth";

    @Bean
    public OpenAPI governanceOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Citi Governance API")
                        .version("v1")
                        .description("REST API for the Citi Governance platform — auth, onboarding, "
                                + "PTS timesheets, profiles, training and KARAT assessment. "
                                + "Most endpoints require a bearer token (obtain one from POST /api/auth/login)."))
                .addSecurityItem(new SecurityRequirement().addList(BEARER))
                .components(new Components().addSecuritySchemes(BEARER,
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("token")
                                .description("Paste the token returned by /api/auth/login")));
    }
}
