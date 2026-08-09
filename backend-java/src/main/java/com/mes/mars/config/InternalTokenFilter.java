package com.mes.mars.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class InternalTokenFilter extends OncePerRequestFilter {

    @Value("${internal.token:}")
    private String expectedToken;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        if (expectedToken == null || expectedToken.isEmpty()) {
            filterChain.doFilter(request, response);
            return;
        }

        String suppliedToken = request.getHeader("X-Internal-Token");
        if (!expectedToken.equals(suppliedToken)) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"forbidden\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }
}
