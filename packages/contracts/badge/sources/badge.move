module talentbank_badge::badge {
    use std::string::{Self, String};
    use sui::vec_map::{Self, VecMap};
    use sui::event;
    use sui::clock::Clock;

    // ======== Errors ========
    const EMintingPaused: u64 = 1;

    // ======== Events ========
    public struct BadgeMinted has copy, drop {
        badge_id: address,
        issued_to: address,
        badge_type: String,
        title: String,
        issued_at: u64,
    }

    public struct VoucherIssued has copy, drop {
        voucher_id: address,
        recipient: address,
        badge_type: String,
    }

    // ======== Objects ========

    /// Shared registry — one per deployment
    public struct BadgeRegistry has key {
        id: UID,
        admin: address,
        badge_count: u64,
        paused: bool,
    }

    /// Admin capability — owned by deployer, required to mint
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Voucher issued by admin — student claims this to receive their badge
    public struct MintVoucher has key {
        id: UID,
        badge_type: String,
        title: String,
        description: String,
        image_url: String,
    }

    /// Soulbound badge — key only (no store) = non-transferable
    public struct AchievementBadge has key {
        id: UID,
        badge_type: String,
        title: String,
        description: String,
        image_url: String,
        issued_to: address,
        issued_at: u64,
        metadata: VecMap<String, String>,
    }

    // ======== Init ========

    fun init(ctx: &mut TxContext) {
        let admin = ctx.sender();

        transfer::transfer(AdminCap { id: object::new(ctx) }, admin);

        transfer::share_object(BadgeRegistry {
            id: object::new(ctx),
            admin,
            badge_count: 0,
            paused: false,
        });
    }

    // ======== Admin Functions ========

    /// Mint a soulbound badge to a student wallet.
    /// Requires the AdminCap — only the wallet that holds it can call this.
    public fun mint_badge(
        _cap: &AdminCap,
        registry: &mut BadgeRegistry,
        recipient: address,
        badge_type: vector<u8>,
        title: vector<u8>,
        description: vector<u8>,
        image_url: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!registry.paused, EMintingPaused);

        let badge = AchievementBadge {
            id: object::new(ctx),
            badge_type: string::utf8(badge_type),
            title: string::utf8(title),
            description: string::utf8(description),
            image_url: string::utf8(image_url),
            issued_to: recipient,
            issued_at: clock.timestamp_ms(),
            metadata: vec_map::empty(),
        };

        event::emit(BadgeMinted {
            badge_id: object::uid_to_address(&badge.id),
            issued_to: recipient,
            badge_type: badge.badge_type,
            title: badge.title,
            issued_at: badge.issued_at,
        });

        registry.badge_count = registry.badge_count + 1;

        // transfer (not public_transfer) because AchievementBadge has no `store`
        transfer::transfer(badge, recipient);
    }

    public fun pause_minting(_cap: &AdminCap, registry: &mut BadgeRegistry) {
        registry.paused = true;
    }

    public fun unpause_minting(_cap: &AdminCap, registry: &mut BadgeRegistry) {
        registry.paused = false;
    }

    /// Issue a MintVoucher to a student — admin signs, voucher transferred to student wallet.
    /// Student can then call claim_badge to receive their AchievementBadge.
    public fun issue_voucher(
        _cap: &AdminCap,
        registry: &BadgeRegistry,
        recipient: address,
        badge_type: vector<u8>,
        title: vector<u8>,
        description: vector<u8>,
        image_url: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(!registry.paused, EMintingPaused);
        let voucher = MintVoucher {
            id: object::new(ctx),
            badge_type: string::utf8(badge_type),
            title: string::utf8(title),
            description: string::utf8(description),
            image_url: string::utf8(image_url),
        };
        event::emit(VoucherIssued {
            voucher_id: object::uid_to_address(&voucher.id),
            recipient,
            badge_type: voucher.badge_type,
        });
        transfer::transfer(voucher, recipient);
    }

    /// Claim a MintVoucher — student signs with their own wallet (no AdminCap needed).
    /// Consumes the voucher and creates an AchievementBadge for the caller.
    public fun claim_badge(
        voucher: MintVoucher,
        registry: &mut BadgeRegistry,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!registry.paused, EMintingPaused);
        let MintVoucher { id, badge_type, title, description, image_url } = voucher;
        object::delete(id);
        let recipient = ctx.sender();
        let badge = AchievementBadge {
            id: object::new(ctx),
            badge_type, title, description, image_url,
            issued_to: recipient,
            issued_at: clock.timestamp_ms(),
            metadata: vec_map::empty(),
        };
        event::emit(BadgeMinted {
            badge_id: object::uid_to_address(&badge.id),
            issued_to: recipient,
            badge_type: badge.badge_type,
            title: badge.title,
            issued_at: badge.issued_at,
        });
        registry.badge_count = registry.badge_count + 1;
        transfer::transfer(badge, recipient);
    }

    // ======== Read Functions ========

    public fun get_badge_count(registry: &BadgeRegistry): u64 {
        registry.badge_count
    }

    public fun get_badge_type(badge: &AchievementBadge): &String {
        &badge.badge_type
    }

    public fun get_issued_to(badge: &AchievementBadge): address {
        badge.issued_to
    }

    public fun is_paused(registry: &BadgeRegistry): bool {
        registry.paused
    }

    // ======== Test Helpers ========

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
