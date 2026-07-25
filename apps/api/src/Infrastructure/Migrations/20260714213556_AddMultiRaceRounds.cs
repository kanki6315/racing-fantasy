using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EnduranceFantasy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMultiRaceRounds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_session_round_id_class_id_type",
                table: "session");

            migrationBuilder.DropIndex(
                name: "ix_score_pick_id_source",
                table: "score");

            migrationBuilder.AddColumn<int>(
                name: "race_number",
                table: "session",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<long>(
                name: "session_id",
                table: "score_audit",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "session_id",
                table: "score",
                type: "bigint",
                nullable: true);

            // Backfill: tie every existing pick-owned position score to its session. Deterministic
            // pre-multi-race because each (round, class, type) has exactly one session. Rows whose
            // session was deleted stay NULL — deduped by the NULLS-NOT-DISTINCT unique index below
            // and removed by the scoring engine's stale-score cleanup on the next recompute.
            migrationBuilder.Sql("""
                UPDATE score s SET session_id = sess.id
                FROM pick p
                JOIN roster r ON p.roster_id = r.id
                JOIN session sess ON sess.round_id = r.round_id AND sess.class_id = p.class_id
                WHERE s.pick_id = p.id
                  AND ((s.source = 'QualifyingPosition' AND sess.type = 'Qualifying')
                    OR (s.source = 'RacePosition'      AND sess.type = 'Race'));
                """);

            migrationBuilder.CreateIndex(
                name: "ix_session_round_id_class_id_type_race_number",
                table: "session",
                columns: new[] { "round_id", "class_id", "type", "race_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_score_pick_id_source_session_id",
                table: "score",
                columns: new[] { "pick_id", "source", "session_id" },
                unique: true,
                filter: "pick_id IS NOT NULL")
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.CreateIndex(
                name: "ix_score_session_id",
                table: "score",
                column: "session_id");

            migrationBuilder.AddForeignKey(
                name: "fk_score_sessions_session_id",
                table: "score",
                column: "session_id",
                principalTable: "session",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_score_sessions_session_id",
                table: "score");

            migrationBuilder.DropIndex(
                name: "ix_session_round_id_class_id_type_race_number",
                table: "session");

            migrationBuilder.DropIndex(
                name: "ix_score_pick_id_source_session_id",
                table: "score");

            migrationBuilder.DropIndex(
                name: "ix_score_session_id",
                table: "score");

            migrationBuilder.DropColumn(
                name: "race_number",
                table: "session");

            migrationBuilder.DropColumn(
                name: "session_id",
                table: "score_audit");

            migrationBuilder.DropColumn(
                name: "session_id",
                table: "score");

            // NOTE: recreating this unique index fails if any round already has two race sessions
            // for one class — delete the extra sessions (and their results/scores) before reverting.
            migrationBuilder.CreateIndex(
                name: "ix_session_round_id_class_id_type",
                table: "session",
                columns: new[] { "round_id", "class_id", "type" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_score_pick_id_source",
                table: "score",
                columns: new[] { "pick_id", "source" },
                unique: true,
                filter: "pick_id IS NOT NULL");
        }
    }
}
