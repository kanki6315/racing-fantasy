using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace EnduranceFantasy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RosterModifiers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Retire the IMPACT "bonus driver" slot (ADR-0006 D1). No-op on a fresh DB; on an existing
            // dev DB this removes accumulated IMPACT picks, their scores, and the IMPACT roster rule.
            // Ordered to respect the score/pick FKs. Enum values are stored as their PascalCase names.
            migrationBuilder.Sql(
                "DELETE FROM score_audit WHERE pick_id IN (SELECT id FROM pick WHERE slot_type = 'Impact');");
            migrationBuilder.Sql(
                "DELETE FROM score WHERE pick_id IN (SELECT id FROM pick WHERE slot_type = 'Impact');");
            migrationBuilder.Sql("DELETE FROM pick WHERE slot_type = 'Impact';");
            migrationBuilder.Sql("DELETE FROM roster_rule WHERE slot_type = 'Impact';");

            migrationBuilder.DropIndex(
                name: "ix_score_pick_id_source",
                table: "score");

            migrationBuilder.AlterColumn<long>(
                name: "pick_id",
                table: "score_audit",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AddColumn<long>(
                name: "roster_modifier_id",
                table: "score_audit",
                type: "bigint",
                nullable: true);

            migrationBuilder.AlterColumn<long>(
                name: "pick_id",
                table: "score",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AddColumn<long>(
                name: "roster_modifier_id",
                table: "score",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "roster_modifier",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    roster_id = table.Column<long>(type: "bigint", nullable: false),
                    kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    target_pick_id = table.Column<long>(type: "bigint", nullable: true),
                    @params = table.Column<string>(name: "params", type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_roster_modifier", x => x.id);
                    table.ForeignKey(
                        name: "fk_roster_modifier_pick_target_pick_id",
                        column: x => x.target_pick_id,
                        principalTable: "pick",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_roster_modifier_roster_roster_id",
                        column: x => x.roster_id,
                        principalTable: "roster",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "roster_modifier_rule",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    season_id = table.Column<long>(type: "bigint", nullable: false),
                    kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    max_count = table.Column<int>(type: "integer", nullable: false),
                    applies_to = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_roster_modifier_rule", x => x.id);
                    table.ForeignKey(
                        name: "fk_roster_modifier_rule_seasons_season_id",
                        column: x => x.season_id,
                        principalTable: "season",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_score_audit_roster_modifier_id",
                table: "score_audit",
                column: "roster_modifier_id");

            migrationBuilder.CreateIndex(
                name: "ix_score_pick_id_source",
                table: "score",
                columns: new[] { "pick_id", "source" },
                unique: true,
                filter: "pick_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_score_roster_modifier_id_source",
                table: "score",
                columns: new[] { "roster_modifier_id", "source" },
                unique: true,
                filter: "roster_modifier_id IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "ck_score_one_owner",
                table: "score",
                sql: "(pick_id IS NULL) <> (roster_modifier_id IS NULL)");

            migrationBuilder.CreateIndex(
                name: "ix_roster_modifier_roster_id_kind",
                table: "roster_modifier",
                columns: new[] { "roster_id", "kind" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_roster_modifier_target_pick_id",
                table: "roster_modifier",
                column: "target_pick_id");

            migrationBuilder.CreateIndex(
                name: "ix_roster_modifier_rule_season_id_kind",
                table: "roster_modifier_rule",
                columns: new[] { "season_id", "kind" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_score_roster_modifier_roster_modifier_id",
                table: "score",
                column: "roster_modifier_id",
                principalTable: "roster_modifier",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_score_audit_roster_modifier_roster_modifier_id",
                table: "score_audit",
                column: "roster_modifier_id",
                principalTable: "roster_modifier",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_score_roster_modifier_roster_modifier_id",
                table: "score");

            migrationBuilder.DropForeignKey(
                name: "fk_score_audit_roster_modifier_roster_modifier_id",
                table: "score_audit");

            migrationBuilder.DropTable(
                name: "roster_modifier");

            migrationBuilder.DropTable(
                name: "roster_modifier_rule");

            migrationBuilder.DropIndex(
                name: "ix_score_audit_roster_modifier_id",
                table: "score_audit");

            migrationBuilder.DropIndex(
                name: "ix_score_pick_id_source",
                table: "score");

            migrationBuilder.DropIndex(
                name: "ix_score_roster_modifier_id_source",
                table: "score");

            migrationBuilder.DropCheckConstraint(
                name: "ck_score_one_owner",
                table: "score");

            migrationBuilder.DropColumn(
                name: "roster_modifier_id",
                table: "score_audit");

            migrationBuilder.DropColumn(
                name: "roster_modifier_id",
                table: "score");

            migrationBuilder.AlterColumn<long>(
                name: "pick_id",
                table: "score_audit",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.AlterColumn<long>(
                name: "pick_id",
                table: "score",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_score_pick_id_source",
                table: "score",
                columns: new[] { "pick_id", "source" },
                unique: true);
        }
    }
}
