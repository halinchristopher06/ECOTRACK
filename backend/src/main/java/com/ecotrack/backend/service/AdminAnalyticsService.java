package com.ecotrack.backend.service;

import com.ecotrack.backend.dto.AdminStatsResponse;
import com.ecotrack.backend.model.UserAccount;
import com.ecotrack.backend.model.UserRole;
import com.ecotrack.backend.repository.ApplianceRepository;
import com.ecotrack.backend.repository.BillRepository;
import com.ecotrack.backend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.ZoneOffset;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AdminAnalyticsService {

    private final AuthService authService;
    private final UserRepository userRepository;
    private final BillRepository billRepository;
    private final ApplianceRepository applianceRepository;

    public AdminAnalyticsService(
            AuthService authService,
            UserRepository userRepository,
            BillRepository billRepository,
            ApplianceRepository applianceRepository
    ) {
        this.authService = authService;
        this.userRepository = userRepository;
        this.billRepository = billRepository;
        this.applianceRepository = applianceRepository;
    }

    public AdminStatsResponse getStats(String token) {
        authService.requireAdmin(token);

        List<UserAccount> allUsers = userRepository.findAll();
        long totalUsers = allUsers.size();
        long verifiedUsers = allUsers.stream().filter(UserAccount::isVerified).count();
        long unverifiedUsers = totalUsers - verifiedUsers;

        Map<String, Long> usersByRole = allUsers.stream()
                .collect(Collectors.groupingBy(
                        u -> u.getRole() == null ? UserRole.CUSTOMER.name() : u.getRole().name(),
                        Collectors.counting()));

        List<AdminStatsResponse.MonthlySignupCount> signupsByMonth = buildSignupsByMonth(allUsers);

        return new AdminStatsResponse(
                totalUsers,
                verifiedUsers,
                unverifiedUsers,
                billRepository.count(),
                applianceRepository.count(),
                usersByRole,
                signupsByMonth
        );
    }

    /**
     * Last 6 calendar months (including the current one), counting only UserAccounts with a
     * real createdAt timestamp. Accounts predating that field are simply not counted in any
     * month rather than being guessed at — see UserAccount.createdAt.
     */
    private List<AdminStatsResponse.MonthlySignupCount> buildSignupsByMonth(List<UserAccount> allUsers) {
        YearMonth current = YearMonth.now(ZoneOffset.UTC);
        List<YearMonth> months = new ArrayList<>();
        for (int i = 5; i >= 0; i--) {
            months.add(current.minusMonths(i));
        }

        Map<YearMonth, Long> counts = allUsers.stream()
                .filter(u -> u.getCreatedAt() != null)
                .map(u -> YearMonth.from(u.getCreatedAt().atZone(ZoneOffset.UTC)))
                .collect(Collectors.groupingBy(ym -> ym, Collectors.counting()));

        List<AdminStatsResponse.MonthlySignupCount> result = new ArrayList<>();
        for (YearMonth ym : months) {
            result.add(new AdminStatsResponse.MonthlySignupCount(ym.toString(), counts.getOrDefault(ym, 0L)));
        }
        return result;
    }
}
