using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ImsaFantasy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddChampionshipOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "sort_order",
                table: "championship",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "sort_order",
                table: "championship");
        }
    }
}
