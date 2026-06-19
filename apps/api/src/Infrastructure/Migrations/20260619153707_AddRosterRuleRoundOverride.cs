using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ImsaFantasy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRosterRuleRoundOverride : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_roster_rule_season_id_class_id_slot_type",
                table: "roster_rule");

            migrationBuilder.AddColumn<long>(
                name: "round_id",
                table: "roster_rule",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_roster_rule_round_id",
                table: "roster_rule",
                column: "round_id");

            migrationBuilder.CreateIndex(
                name: "ix_roster_rule_season_id_round_id_class_id_slot_type",
                table: "roster_rule",
                columns: new[] { "season_id", "round_id", "class_id", "slot_type" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.AddForeignKey(
                name: "fk_roster_rule_rounds_round_id",
                table: "roster_rule",
                column: "round_id",
                principalTable: "round",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_roster_rule_rounds_round_id",
                table: "roster_rule");

            migrationBuilder.DropIndex(
                name: "ix_roster_rule_round_id",
                table: "roster_rule");

            migrationBuilder.DropIndex(
                name: "ix_roster_rule_season_id_round_id_class_id_slot_type",
                table: "roster_rule");

            migrationBuilder.DropColumn(
                name: "round_id",
                table: "roster_rule");

            migrationBuilder.CreateIndex(
                name: "ix_roster_rule_season_id_class_id_slot_type",
                table: "roster_rule",
                columns: new[] { "season_id", "class_id", "slot_type" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);
        }
    }
}
