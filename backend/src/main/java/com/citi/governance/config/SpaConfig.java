package com.citi.governance.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

/**
 * Serves the bundled React build (classpath:/static) and, for any non-API path that doesn't map to a
 * real file, falls back to index.html so client-side routes (/onboarding, /people, …) work on refresh.
 */
@Configuration
public class SpaConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String resourcePath, Resource location) throws IOException {
                        Resource requested = location.createRelative(resourcePath);
                        if (requested.exists() && requested.isReadable()) {
                            return requested;
                        }
                        // Don't swallow API or API-docs/Swagger routes - let their own handlers serve them.
                        if (resourcePath.startsWith("api/")
                                || resourcePath.startsWith("v3/")
                                || resourcePath.startsWith("swagger-ui")
                                || resourcePath.startsWith("webjars/")
                                || resourcePath.startsWith("swagger-resources")
                                || resourcePath.startsWith("actuator")) {
                            return null;
                        }
                        Resource index = new ClassPathResource("/static/index.html");
                        return index.exists() ? index : null;
                    }
                });
    }
}
