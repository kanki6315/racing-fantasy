using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ImsaFantasy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEventPicksOpen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "picks_open",
                table: "event",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "picks_open",
                table: "event");
        }
    }
}
