using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EnduranceFantasy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEventScoredFinalized : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "finalized",
                table: "event",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "scored",
                table: "event",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "finalized",
                table: "event");

            migrationBuilder.DropColumn(
                name: "scored",
                table: "event");
        }
    }
}
