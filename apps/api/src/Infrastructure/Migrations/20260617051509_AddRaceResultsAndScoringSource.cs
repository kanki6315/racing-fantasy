using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace EnduranceFantasy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRaceResultsAndScoringSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_scoring_ruleset_season_id_slot_type_version",
                table: "scoring_ruleset");

            migrationBuilder.DropIndex(
                name: "ix_score_pick_id_rule_version",
                table: "score");

            migrationBuilder.DropColumn(
                name: "slot_type",
                table: "scoring_ruleset");

            migrationBuilder.AddColumn<string>(
                name: "source",
                table: "scoring_ruleset",
                type: "character varying(24)",
                maxLength: 24,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "source",
                table: "score_audit",
                type: "character varying(24)",
                maxLength: 24,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "source",
                table: "score",
                type: "character varying(24)",
                maxLength: 24,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "race_result",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    session_id = table.Column<long>(type: "bigint", nullable: false),
                    car_entry_id = table.Column<long>(type: "bigint", nullable: false),
                    class_id = table.Column<long>(type: "bigint", nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "text", nullable: true),
                    laps = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_race_result", x => x.id);
                    table.ForeignKey(
                        name: "fk_race_result_car_entry_car_entry_id",
                        column: x => x.car_entry_id,
                        principalTable: "car_entry",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_race_result_class_class_id",
                        column: x => x.class_id,
                        principalTable: "class",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_race_result_sessions_session_id",
                        column: x => x.session_id,
                        principalTable: "session",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_scoring_ruleset_season_id_source_version",
                table: "scoring_ruleset",
                columns: new[] { "season_id", "source", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_score_pick_id_source",
                table: "score",
                columns: new[] { "pick_id", "source" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_race_result_car_entry_id",
                table: "race_result",
                column: "car_entry_id");

            migrationBuilder.CreateIndex(
                name: "ix_race_result_class_id",
                table: "race_result",
                column: "class_id");

            migrationBuilder.CreateIndex(
                name: "ix_race_result_session_id_car_entry_id",
                table: "race_result",
                columns: new[] { "session_id", "car_entry_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "race_result");

            migrationBuilder.DropIndex(
                name: "ix_scoring_ruleset_season_id_source_version",
                table: "scoring_ruleset");

            migrationBuilder.DropIndex(
                name: "ix_score_pick_id_source",
                table: "score");

            migrationBuilder.DropColumn(
                name: "source",
                table: "scoring_ruleset");

            migrationBuilder.DropColumn(
                name: "source",
                table: "score_audit");

            migrationBuilder.DropColumn(
                name: "source",
                table: "score");

            migrationBuilder.AddColumn<string>(
                name: "slot_type",
                table: "scoring_ruleset",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "ix_scoring_ruleset_season_id_slot_type_version",
                table: "scoring_ruleset",
                columns: new[] { "season_id", "slot_type", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_score_pick_id_rule_version",
                table: "score",
                columns: new[] { "pick_id", "rule_version" },
                unique: true);
        }
    }
}
