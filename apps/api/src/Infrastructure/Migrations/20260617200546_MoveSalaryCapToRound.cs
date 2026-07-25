using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EnduranceFantasy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MoveSalaryCapToRound : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1) Add the new per-round cap (default 0).
            migrationBuilder.AddColumn<decimal>(
                name: "salary_cap",
                table: "round",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            // 2) Backfill each round's cap from its season's registrations (the old per-season cap),
            //    so existing rounds keep a workable cap. Rounds in seasons with no registrations stay 0
            //    and an admin sets them via POST/PUT /rounds.
            migrationBuilder.Sql(@"
                UPDATE round
                SET salary_cap = COALESCE(
                    (SELECT MAX(r.salary_cap) FROM registration r WHERE r.season_id = round.season_id),
                    round.salary_cap);");

            // 3) Drop the old per-registration cap.
            migrationBuilder.DropColumn(
                name: "salary_cap",
                table: "registration");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "salary_cap",
                table: "round");

            migrationBuilder.AddColumn<decimal>(
                name: "salary_cap",
                table: "registration",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 0m);
        }
    }
}
