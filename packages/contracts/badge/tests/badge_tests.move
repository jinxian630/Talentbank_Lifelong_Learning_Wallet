#[test_only]
module talentbank_badge::badge_tests {
    use sui::test_scenario::{Self, next_tx, ctx};
    use sui::clock;
    use talentbank_badge::badge::{Self, BadgeRegistry, AdminCap, MintVoucher};

    const ADMIN: address = @0xAD;
    const STUDENT: address = @0x57;

    #[test]
    fun test_init_creates_registry_and_cap() {
        let mut scenario = test_scenario::begin(ADMIN);

        // init is called automatically by the framework when the module is published;
        // simulate it by calling the init function directly in tests via test_only init
        {
            badge::init_for_testing(ctx(&mut scenario));
        };

        next_tx(&mut scenario, ADMIN);
        {
            // Admin should own the AdminCap
            assert!(test_scenario::has_most_recent_for_sender<AdminCap>(&scenario), 0);
            // BadgeRegistry should be a shared object
            let registry = test_scenario::take_shared<BadgeRegistry>(&scenario);
            assert!(badge::get_badge_count(&registry) == 0, 1);
            assert!(!badge::is_paused(&registry), 2);
            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_mint_badge_succeeds() {
        let mut scenario = test_scenario::begin(ADMIN);

        {
            badge::init_for_testing(ctx(&mut scenario));
        };

        next_tx(&mut scenario, ADMIN);
        {
            let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
            let mut registry = test_scenario::take_shared<BadgeRegistry>(&scenario);
            let clk = clock::create_for_testing(ctx(&mut scenario));

            badge::mint_badge(
                &cap,
                &mut registry,
                STUDENT,
                b"EVENT_ATTENDANCE",
                b"Test Badge",
                b"A test badge",
                b"https://example.com/badge.png",
                &clk,
                ctx(&mut scenario),
            );

            assert!(badge::get_badge_count(&registry) == 1, 0);

            clock::destroy_for_testing(clk);
            test_scenario::return_to_sender(&scenario, cap);
            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 1, location = talentbank_badge::badge)]
    fun test_mint_fails_when_paused() {
        let mut scenario = test_scenario::begin(ADMIN);

        {
            badge::init_for_testing(ctx(&mut scenario));
        };

        next_tx(&mut scenario, ADMIN);
        {
            let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
            let mut registry = test_scenario::take_shared<BadgeRegistry>(&scenario);
            let clk = clock::create_for_testing(ctx(&mut scenario));

            badge::pause_minting(&cap, &mut registry);

            badge::mint_badge(
                &cap,
                &mut registry,
                STUDENT,
                b"EVENT_ATTENDANCE",
                b"Test Badge",
                b"Description",
                b"https://example.com/badge.png",
                &clk,
                ctx(&mut scenario),
            );

            clock::destroy_for_testing(clk);
            test_scenario::return_to_sender(&scenario, cap);
            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_issue_voucher_succeeds() {
        let mut scenario = test_scenario::begin(ADMIN);
        { badge::init_for_testing(ctx(&mut scenario)); };

        next_tx(&mut scenario, ADMIN);
        {
            let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
            let registry = test_scenario::take_shared<BadgeRegistry>(&scenario);

            badge::issue_voucher(
                &cap,
                &registry,
                STUDENT,
                b"EVENT_ATTENDANCE",
                b"Test Badge",
                b"A test badge",
                b"https://example.com/badge.png",
                ctx(&mut scenario),
            );

            test_scenario::return_to_sender(&scenario, cap);
            test_scenario::return_shared(registry);
        };

        // Student should now own the MintVoucher
        next_tx(&mut scenario, STUDENT);
        {
            assert!(test_scenario::has_most_recent_for_sender<MintVoucher>(&scenario), 0);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_claim_badge_succeeds() {
        let mut scenario = test_scenario::begin(ADMIN);
        { badge::init_for_testing(ctx(&mut scenario)); };

        // Admin issues voucher
        next_tx(&mut scenario, ADMIN);
        {
            let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
            let registry = test_scenario::take_shared<BadgeRegistry>(&scenario);
            badge::issue_voucher(
                &cap, &registry, STUDENT,
                b"EVENT_ATTENDANCE", b"Test Badge", b"Desc", b"https://img",
                ctx(&mut scenario),
            );
            test_scenario::return_to_sender(&scenario, cap);
            test_scenario::return_shared(registry);
        };

        // Student claims the badge
        next_tx(&mut scenario, STUDENT);
        {
            let voucher = test_scenario::take_from_sender<MintVoucher>(&scenario);
            let mut registry = test_scenario::take_shared<BadgeRegistry>(&scenario);
            let clk = clock::create_for_testing(ctx(&mut scenario));

            badge::claim_badge(voucher, &mut registry, &clk, ctx(&mut scenario));

            assert!(badge::get_badge_count(&registry) == 1, 0);

            clock::destroy_for_testing(clk);
            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 1, location = talentbank_badge::badge)]
    fun test_claim_fails_when_paused() {
        let mut scenario = test_scenario::begin(ADMIN);
        { badge::init_for_testing(ctx(&mut scenario)); };

        next_tx(&mut scenario, ADMIN);
        {
            let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
            let registry = test_scenario::take_shared<BadgeRegistry>(&scenario);
            badge::issue_voucher(
                &cap, &registry, STUDENT,
                b"EVENT_ATTENDANCE", b"Test Badge", b"Desc", b"https://img",
                ctx(&mut scenario),
            );
            test_scenario::return_to_sender(&scenario, cap);
            test_scenario::return_shared(registry);
        };

        next_tx(&mut scenario, ADMIN);
        {
            let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
            let mut registry = test_scenario::take_shared<BadgeRegistry>(&scenario);
            badge::pause_minting(&cap, &mut registry);
            test_scenario::return_to_sender(&scenario, cap);
            test_scenario::return_shared(registry);
        };

        next_tx(&mut scenario, STUDENT);
        {
            let voucher = test_scenario::take_from_sender<MintVoucher>(&scenario);
            let mut registry = test_scenario::take_shared<BadgeRegistry>(&scenario);
            let clk = clock::create_for_testing(ctx(&mut scenario));
            badge::claim_badge(voucher, &mut registry, &clk, ctx(&mut scenario));
            clock::destroy_for_testing(clk);
            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }
}
