using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ImsaFantasy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "app_user",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    email = table.Column<string>(type: "text", nullable: false),
                    display_name = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_app_user", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "championship",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "text", nullable: false),
                    slug = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_championship", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "driver",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    full_name = table.Column<string>(type: "text", nullable: false),
                    country = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_driver", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "class",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    championship_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_class", x => x.id);
                    table.ForeignKey(
                        name: "fk_class_championship_championship_id",
                        column: x => x.championship_id,
                        principalTable: "championship",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "season",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    championship_id = table.Column<long>(type: "bigint", nullable: false),
                    year = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_season", x => x.id);
                    table.ForeignKey(
                        name: "fk_season_championship_championship_id",
                        column: x => x.championship_id,
                        principalTable: "championship",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "car_entry",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    season_id = table.Column<long>(type: "bigint", nullable: false),
                    class_id = table.Column<long>(type: "bigint", nullable: false),
                    number = table.Column<string>(type: "text", nullable: false),
                    team_name = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_car_entry", x => x.id);
                    table.ForeignKey(
                        name: "fk_car_entry_classes_class_id",
                        column: x => x.class_id,
                        principalTable: "class",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_car_entry_seasons_season_id",
                        column: x => x.season_id,
                        principalTable: "season",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "registration",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    season_id = table.Column<long>(type: "bigint", nullable: false),
                    salary_cap = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_registration", x => x.id);
                    table.ForeignKey(
                        name: "fk_registration_app_user_user_id",
                        column: x => x.user_id,
                        principalTable: "app_user",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_registration_seasons_season_id",
                        column: x => x.season_id,
                        principalTable: "season",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "roster_rule",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    season_id = table.Column<long>(type: "bigint", nullable: false),
                    class_id = table.Column<long>(type: "bigint", nullable: true),
                    slot_type = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    min_picks = table.Column<int>(type: "integer", nullable: false),
                    max_picks = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_roster_rule", x => x.id);
                    table.ForeignKey(
                        name: "fk_roster_rule_class_class_id",
                        column: x => x.class_id,
                        principalTable: "class",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_roster_rule_seasons_season_id",
                        column: x => x.season_id,
                        principalTable: "season",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "round",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    season_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    circuit = table.Column<string>(type: "text", nullable: true),
                    sequence = table.Column<int>(type: "integer", nullable: false),
                    quali_start = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    starts_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ends_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_round", x => x.id);
                    table.ForeignKey(
                        name: "fk_round_seasons_season_id",
                        column: x => x.season_id,
                        principalTable: "season",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "scoring_ruleset",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    season_id = table.Column<long>(type: "bigint", nullable: false),
                    slot_type = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    effective_from = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_scoring_ruleset", x => x.id);
                    table.ForeignKey(
                        name: "fk_scoring_ruleset_seasons_season_id",
                        column: x => x.season_id,
                        principalTable: "season",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "entry_driver",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    car_entry_id = table.Column<long>(type: "bigint", nullable: false),
                    driver_id = table.Column<long>(type: "bigint", nullable: false),
                    season_id = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_entry_driver", x => x.id);
                    table.ForeignKey(
                        name: "fk_entry_driver_car_entry_car_entry_id",
                        column: x => x.car_entry_id,
                        principalTable: "car_entry",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_entry_driver_driver_driver_id",
                        column: x => x.driver_id,
                        principalTable: "driver",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "entity_price",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    round_id = table.Column<long>(type: "bigint", nullable: false),
                    entity_type = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    entity_id = table.Column<long>(type: "bigint", nullable: false),
                    class_id = table.Column<long>(type: "bigint", nullable: false),
                    price = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_entity_price", x => x.id);
                    table.ForeignKey(
                        name: "fk_entity_price_class_class_id",
                        column: x => x.class_id,
                        principalTable: "class",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_entity_price_rounds_round_id",
                        column: x => x.round_id,
                        principalTable: "round",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "roster",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    registration_id = table.Column<long>(type: "bigint", nullable: false),
                    round_id = table.Column<long>(type: "bigint", nullable: false),
                    locked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_roster", x => x.id);
                    table.ForeignKey(
                        name: "fk_roster_registration_registration_id",
                        column: x => x.registration_id,
                        principalTable: "registration",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_roster_rounds_round_id",
                        column: x => x.round_id,
                        principalTable: "round",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "round_total",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    registration_id = table.Column<long>(type: "bigint", nullable: false),
                    round_id = table.Column<long>(type: "bigint", nullable: false),
                    points = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_round_total", x => x.id);
                    table.ForeignKey(
                        name: "fk_round_total_registration_registration_id",
                        column: x => x.registration_id,
                        principalTable: "registration",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_round_total_round_round_id",
                        column: x => x.round_id,
                        principalTable: "round",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "session",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    round_id = table.Column<long>(type: "bigint", nullable: false),
                    class_id = table.Column<long>(type: "bigint", nullable: false),
                    type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    scheduled_start = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    actual_start = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_session", x => x.id);
                    table.ForeignKey(
                        name: "fk_session_class_class_id",
                        column: x => x.class_id,
                        principalTable: "class",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_session_round_round_id",
                        column: x => x.round_id,
                        principalTable: "round",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "position_points",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ruleset_id = table.Column<long>(type: "bigint", nullable: false),
                    rank = table.Column<int>(type: "integer", nullable: false),
                    points = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_position_points", x => x.id);
                    table.ForeignKey(
                        name: "fk_position_points_scoring_rulesets_ruleset_id",
                        column: x => x.ruleset_id,
                        principalTable: "scoring_ruleset",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "scoring_bonus",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ruleset_id = table.Column<long>(type: "bigint", nullable: false),
                    kind = table.Column<string>(type: "text", nullable: false),
                    @params = table.Column<string>(name: "params", type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_scoring_bonus", x => x.id);
                    table.ForeignKey(
                        name: "fk_scoring_bonus_scoring_rulesets_ruleset_id",
                        column: x => x.ruleset_id,
                        principalTable: "scoring_ruleset",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pick",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    roster_id = table.Column<long>(type: "bigint", nullable: false),
                    slot_type = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    entity_type = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    entity_id = table.Column<long>(type: "bigint", nullable: false),
                    class_id = table.Column<long>(type: "bigint", nullable: false),
                    price_at_lock = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pick", x => x.id);
                    table.ForeignKey(
                        name: "fk_pick_class_class_id",
                        column: x => x.class_id,
                        principalTable: "class",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_pick_rosters_roster_id",
                        column: x => x.roster_id,
                        principalTable: "roster",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "quali_result",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    session_id = table.Column<long>(type: "bigint", nullable: false),
                    car_entry_id = table.Column<long>(type: "bigint", nullable: false),
                    class_id = table.Column<long>(type: "bigint", nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false),
                    best_lap_ms = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_quali_result", x => x.id);
                    table.ForeignKey(
                        name: "fk_quali_result_car_entry_car_entry_id",
                        column: x => x.car_entry_id,
                        principalTable: "car_entry",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_quali_result_class_class_id",
                        column: x => x.class_id,
                        principalTable: "class",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_quali_result_sessions_session_id",
                        column: x => x.session_id,
                        principalTable: "session",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "race_fastest_lap",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    session_id = table.Column<long>(type: "bigint", nullable: false),
                    driver_id = table.Column<long>(type: "bigint", nullable: false),
                    class_id = table.Column<long>(type: "bigint", nullable: false),
                    fastest_lap_ms = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_race_fastest_lap", x => x.id);
                    table.ForeignKey(
                        name: "fk_race_fastest_lap_class_class_id",
                        column: x => x.class_id,
                        principalTable: "class",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_race_fastest_lap_driver_driver_id",
                        column: x => x.driver_id,
                        principalTable: "driver",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_race_fastest_lap_sessions_session_id",
                        column: x => x.session_id,
                        principalTable: "session",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "score",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    roster_id = table.Column<long>(type: "bigint", nullable: false),
                    pick_id = table.Column<long>(type: "bigint", nullable: false),
                    points = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    rule_version = table.Column<int>(type: "integer", nullable: false),
                    computed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_score", x => x.id);
                    table.ForeignKey(
                        name: "fk_score_pick_pick_id",
                        column: x => x.pick_id,
                        principalTable: "pick",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_score_roster_roster_id",
                        column: x => x.roster_id,
                        principalTable: "roster",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "score_audit",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    pick_id = table.Column<long>(type: "bigint", nullable: false),
                    rule_version = table.Column<int>(type: "integer", nullable: false),
                    old_points = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    new_points = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    reason = table.Column<string>(type: "text", nullable: true),
                    computed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_score_audit", x => x.id);
                    table.ForeignKey(
                        name: "fk_score_audit_pick_pick_id",
                        column: x => x.pick_id,
                        principalTable: "pick",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_app_user_email",
                table: "app_user",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_car_entry_class_id",
                table: "car_entry",
                column: "class_id");

            migrationBuilder.CreateIndex(
                name: "ix_car_entry_season_id_class_id_number",
                table: "car_entry",
                columns: new[] { "season_id", "class_id", "number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_championship_slug",
                table: "championship",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_class_championship_id_name",
                table: "class",
                columns: new[] { "championship_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_entity_price_class_id",
                table: "entity_price",
                column: "class_id");

            migrationBuilder.CreateIndex(
                name: "ix_entity_price_round_id_entity_type_entity_id",
                table: "entity_price",
                columns: new[] { "round_id", "entity_type", "entity_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_entry_driver_car_entry_id_driver_id",
                table: "entry_driver",
                columns: new[] { "car_entry_id", "driver_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_entry_driver_driver_id",
                table: "entry_driver",
                column: "driver_id");

            migrationBuilder.CreateIndex(
                name: "ix_pick_class_id",
                table: "pick",
                column: "class_id");

            migrationBuilder.CreateIndex(
                name: "ix_pick_roster_id_slot_type_entity_type_entity_id",
                table: "pick",
                columns: new[] { "roster_id", "slot_type", "entity_type", "entity_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_position_points_ruleset_id_rank",
                table: "position_points",
                columns: new[] { "ruleset_id", "rank" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_quali_result_car_entry_id",
                table: "quali_result",
                column: "car_entry_id");

            migrationBuilder.CreateIndex(
                name: "ix_quali_result_class_id",
                table: "quali_result",
                column: "class_id");

            migrationBuilder.CreateIndex(
                name: "ix_quali_result_session_id_car_entry_id",
                table: "quali_result",
                columns: new[] { "session_id", "car_entry_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_race_fastest_lap_class_id",
                table: "race_fastest_lap",
                column: "class_id");

            migrationBuilder.CreateIndex(
                name: "ix_race_fastest_lap_driver_id",
                table: "race_fastest_lap",
                column: "driver_id");

            migrationBuilder.CreateIndex(
                name: "ix_race_fastest_lap_session_id_driver_id",
                table: "race_fastest_lap",
                columns: new[] { "session_id", "driver_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_registration_season_id",
                table: "registration",
                column: "season_id");

            migrationBuilder.CreateIndex(
                name: "ix_registration_user_id_season_id",
                table: "registration",
                columns: new[] { "user_id", "season_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_roster_registration_id_round_id",
                table: "roster",
                columns: new[] { "registration_id", "round_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_roster_round_id",
                table: "roster",
                column: "round_id");

            migrationBuilder.CreateIndex(
                name: "ix_roster_rule_class_id",
                table: "roster_rule",
                column: "class_id");

            migrationBuilder.CreateIndex(
                name: "ix_roster_rule_season_id_class_id_slot_type",
                table: "roster_rule",
                columns: new[] { "season_id", "class_id", "slot_type" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.CreateIndex(
                name: "ix_round_season_id_sequence",
                table: "round",
                columns: new[] { "season_id", "sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_round_total_registration_id_round_id",
                table: "round_total",
                columns: new[] { "registration_id", "round_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_round_total_round_id",
                table: "round_total",
                column: "round_id");

            migrationBuilder.CreateIndex(
                name: "ix_score_pick_id_rule_version",
                table: "score",
                columns: new[] { "pick_id", "rule_version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_score_roster_id",
                table: "score",
                column: "roster_id");

            migrationBuilder.CreateIndex(
                name: "ix_score_audit_pick_id",
                table: "score_audit",
                column: "pick_id");

            migrationBuilder.CreateIndex(
                name: "ix_scoring_bonus_ruleset_id",
                table: "scoring_bonus",
                column: "ruleset_id");

            migrationBuilder.CreateIndex(
                name: "ix_scoring_ruleset_season_id_slot_type_version",
                table: "scoring_ruleset",
                columns: new[] { "season_id", "slot_type", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_season_championship_id_year",
                table: "season",
                columns: new[] { "championship_id", "year" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_session_class_id",
                table: "session",
                column: "class_id");

            migrationBuilder.CreateIndex(
                name: "ix_session_round_id_class_id_type",
                table: "session",
                columns: new[] { "round_id", "class_id", "type" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "entity_price");

            migrationBuilder.DropTable(
                name: "entry_driver");

            migrationBuilder.DropTable(
                name: "position_points");

            migrationBuilder.DropTable(
                name: "quali_result");

            migrationBuilder.DropTable(
                name: "race_fastest_lap");

            migrationBuilder.DropTable(
                name: "roster_rule");

            migrationBuilder.DropTable(
                name: "round_total");

            migrationBuilder.DropTable(
                name: "score");

            migrationBuilder.DropTable(
                name: "score_audit");

            migrationBuilder.DropTable(
                name: "scoring_bonus");

            migrationBuilder.DropTable(
                name: "car_entry");

            migrationBuilder.DropTable(
                name: "driver");

            migrationBuilder.DropTable(
                name: "session");

            migrationBuilder.DropTable(
                name: "pick");

            migrationBuilder.DropTable(
                name: "scoring_ruleset");

            migrationBuilder.DropTable(
                name: "class");

            migrationBuilder.DropTable(
                name: "roster");

            migrationBuilder.DropTable(
                name: "registration");

            migrationBuilder.DropTable(
                name: "round");

            migrationBuilder.DropTable(
                name: "app_user");

            migrationBuilder.DropTable(
                name: "season");

            migrationBuilder.DropTable(
                name: "championship");
        }
    }
}
